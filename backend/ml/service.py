"""
service.py — FastAPI ML inference service.

Endpoints:
  POST /predict  → FT-Transformer + XGBoost ensemble + SHAP values
  GET  /health   → service health & model status
  GET  /models   → training metrics

Run:
  uvicorn ml.service:app --host 0.0.0.0 --port 8000 --reload
"""
import os, sys, json, logging
from typing import Dict, Any, List, Optional
import numpy as np
import joblib
import torch
import xgboost as xgb
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(__file__))
from features import FEATURE_NAMES, FEATURE_DISPLAY_NAMES, dict_to_feature_vector
from ft_transformer import build_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
DEVICE     = 'cuda' if torch.cuda.is_available() else 'cpu'
FT_WEIGHT  = 0.45
XGB_WEIGHT = 0.55

app = FastAPI(title='FinStress ML Service', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

# ── Model registry ────────────────────────────────────────────────────────────
class ModelRegistry:
    def __init__(self):
        self.ft_model   = None
        self.xgb_model  = None
        self.scaler     = None
        self.explainer  = None
        self.report     = {}
        self.loaded     = False

    def load(self):
        try:
            # FT-Transformer
            ckpt = torch.load(os.path.join(MODELS_DIR, 'ft_transformer.pt'), map_location=DEVICE)
            self.ft_model = build_model(n_features=ckpt['n_features'], **ckpt['config'])
            self.ft_model.load_state_dict(ckpt['model_state'])
            self.ft_model.eval().to(DEVICE)
            logger.info('✅ FT-Transformer loaded')

            # XGBoost
            self.xgb_model = xgb.XGBRegressor()
            self.xgb_model.load_model(os.path.join(MODELS_DIR, 'xgb_model.json'))
            logger.info('✅ XGBoost loaded')

            # Scaler
            self.scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler.pkl'))
            logger.info('✅ Scaler loaded')

            # SHAP explainer
            bg_path = os.path.join(MODELS_DIR, 'shap_background.npy')
            if os.path.exists(bg_path):
                background = np.load(bg_path)
                self.explainer = shap.TreeExplainer(
                    self.xgb_model, background, feature_perturbation='interventional')
                logger.info('✅ SHAP explainer loaded')

            # Training report
            report_path = os.path.join(MODELS_DIR, 'training_report.json')
            if os.path.exists(report_path):
                with open(report_path) as f:
                    self.report = json.load(f)

            self.loaded = True
        except Exception as e:
            logger.warning(f'⚠️  Models not loaded: {e}. Run python ml/train.py first.')


registry = ModelRegistry()


@app.on_event('startup')
async def startup():
    registry.load()


# ── Request / Response schemas ────────────────────────────────────────────────
class PredictRequest(BaseModel):
    features: Dict[str, float]

class ShapValue(BaseModel):
    feature:      str
    display_name: str
    value:        float
    shap_value:   float
    direction:    str    # 'increases' | 'decreases' | 'neutral'

class PredictResponse(BaseModel):
    ft:       Dict[str, Any]
    xgb:      Dict[str, Any]
    ensemble: Dict[str, Any]
    shap:     Dict[str, Any]
    percentile_rank: Optional[float]


# ── Helper: score → level ────────────────────────────────────────────────────
def score_to_level(score: float) -> str:
    if score < 33:  return 'Low'
    if score < 66:  return 'Medium'
    return 'High'


def score_to_probs(score: float) -> tuple:
    """Soft-assign score to class probabilities via gaussian-like heuristic."""
    centers = [16.5, 49.5, 83.0]
    raw     = [max(0, 1 - abs(score - c) / 33) for c in centers]
    total   = sum(raw)
    return tuple(r / total for r in raw)


# ── Main prediction endpoint ──────────────────────────────────────────────────
@app.post('/predict', response_model=PredictResponse)
async def predict(req: PredictRequest):
    if not registry.loaded:
        # Return rule-based fallback
        fvec    = dict_to_feature_vector(req.features)
        er      = req.features.get('expense_ratio', 1.0)
        score   = float(np.clip((er - 0.3) / 1.7 * 100, 0, 100))
        level   = score_to_level(score)
        pl, pm, ph = score_to_probs(score)
        return PredictResponse(
            ft={'stress_score': score, 'stress_level': level, 'confidence': 0.5},
            xgb={'stress_score': score, 'stress_level': level,
                 'prob_low': pl, 'prob_medium': pm, 'prob_high': ph},
            ensemble={'stress_score': score, 'stress_level': level},
            shap={'values': [], 'base_value': 50.0, 'top_risk': ['expense_ratio'], 'top_positive': []},
            percentile_rank=None,
        )

    try:
        # Build feature vector and scale
        fvec  = dict_to_feature_vector(req.features).reshape(1, -1)
        fvec_s = registry.scaler.transform(fvec)

        # ── FT-Transformer prediction ─────────────────────────────────────────
        with torch.no_grad():
            ft_score = float(registry.ft_model(torch.FloatTensor(fvec_s).to(DEVICE)).item())
        ft_score  = float(np.clip(ft_score, 0, 100))
        ft_level  = score_to_level(ft_score)
        # Confidence proxy: distance from threshold boundary (33 or 66)
        ft_conf   = float(1 - min(abs(ft_score - 33), abs(ft_score - 66)) / 33)

        # ── XGBoost prediction ────────────────────────────────────────────────
        xgb_score = float(np.clip(registry.xgb_model.predict(fvec_s)[0], 0, 100))
        xgb_level = score_to_level(xgb_score)
        pl, pm, ph = score_to_probs(xgb_score)

        # ── Ensemble ──────────────────────────────────────────────────────────
        ens_score = float(np.clip(FT_WEIGHT * ft_score + XGB_WEIGHT * xgb_score, 0, 100))
        ens_level = score_to_level(ens_score)

        # ── SHAP ──────────────────────────────────────────────────────────────
        shap_payload = {'values': [], 'base_value': 50.0, 'top_risk': [], 'top_positive': []}
        if registry.explainer:
            sv = registry.explainer.shap_values(fvec_s)   # (1, F)
            sv_arr = sv[0] if sv.ndim == 2 else sv
            base_val = float(registry.explainer.expected_value
                             if np.isscalar(registry.explainer.expected_value)
                             else registry.explainer.expected_value[0])

            shap_values_list = []
            for i, (fname, sv_val) in enumerate(zip(FEATURE_NAMES, sv_arr)):
                raw_val = float(fvec[0, i])
                shap_val = float(sv_val)
                direction = 'increases' if shap_val > 0 else 'decreases' if shap_val < 0 else 'neutral'
                shap_values_list.append({
                    'feature':      fname,
                    'display_name': FEATURE_DISPLAY_NAMES.get(fname, fname.replace('_', ' ').title()),
                    'value':        round(raw_val, 4),
                    'shap_value':   round(shap_val, 4),
                    'direction':    direction,
                })

            # Sort by |shap| descending
            shap_values_list.sort(key=lambda x: abs(x['shap_value']), reverse=True)

            top_risk     = [s['display_name'] for s in shap_values_list if s['shap_value'] > 0][:3]
            top_positive = [s['display_name'] for s in shap_values_list if s['shap_value'] < 0][:3]

            shap_payload = {
                'values':        shap_values_list[:12],   # top 12 features
                'base_value':    round(base_val, 2),
                'top_risk':      top_risk,
                'top_positive':  top_positive,
            }

        return PredictResponse(
            ft={'stress_score': round(ft_score, 2), 'stress_level': ft_level, 'confidence': round(ft_conf, 3)},
            xgb={'stress_score': round(xgb_score, 2), 'stress_level': xgb_level,
                 'prob_low': round(pl, 3), 'prob_medium': round(pm, 3), 'prob_high': round(ph, 3)},
            ensemble={'stress_score': round(ens_score, 2), 'stress_level': ens_level},
            shap=shap_payload,
            percentile_rank=None,
        )

    except Exception as e:
        logger.exception('Prediction error')
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/health')
async def health():
    return {
        'status': 'ok',
        'models_loaded': registry.loaded,
        'device': DEVICE,
        'feature_count': len(FEATURE_NAMES),
    }

@app.get('/models')
async def model_info():
    return registry.report
