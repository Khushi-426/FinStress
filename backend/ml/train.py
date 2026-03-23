"""
train.py — Train FT-Transformer + XGBoost on the student spending dataset.
Saves both models + scaler to ml/models/.

Usage:
  python ml/train.py --data path/to/student_spending.csv

Outputs:
  ml/models/ft_transformer.pt   — FT-Transformer weights
  ml/models/xgb_model.json      — XGBoost model
  ml/models/scaler.pkl          — StandardScaler
  ml/models/training_report.json — metrics & hyperparams
"""
import os, sys, json, argparse, warnings
import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score, classification_report
import xgboost as xgb
import shap

warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(__file__))

from features import (derive_features, encode_categoricals, build_stress_label,
                      prepare_features, FEATURE_NAMES)
from ft_transformer import build_model

# ── Config ────────────────────────────────────────────────────────────────────
MODELS_DIR  = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

FT_CONFIG = dict(d_token=192, n_heads=8, n_layers=3, dropout=0.1)
XGB_CONFIG = dict(
    n_estimators=500, max_depth=6, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
    reg_alpha=0.1, reg_lambda=1.0, objective='reg:squarederror',
    eval_metric='mae', early_stopping_rounds=30, random_state=42,
)
DEVICE      = 'cuda' if torch.cuda.is_available() else 'cpu'
BATCH_SIZE  = 64
EPOCHS      = 100
LR          = 3e-4
PATIENCE    = 15
SEED        = 42

torch.manual_seed(SEED)
np.random.seed(SEED)


# ── Data loading ──────────────────────────────────────────────────────────────
def load_data(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    # Standardise column names
    df.columns = [c.lower().replace(' ', '_').replace('&', 'and').replace('/', '_')
                  for c in df.columns]
    # Rename to match our schema
    rename = {
        'books_and_supplies': 'books_supplies',
        'health_and_wellness': 'health_wellness',
        'year_in_school': 'year_in_school',
        'preferred_payment_method': 'preferred_payment_method',
    }
    df.rename(columns={k: v for k, v in rename.items() if k in df.columns}, inplace=True)

    # Derive features
    derived = df.apply(derive_features, axis=1)
    df = pd.concat([df, derived], axis=1)
    df = encode_categoricals(df)
    df = build_stress_label(df)
    return df


# ── FT-Transformer training ───────────────────────────────────────────────────
def train_ft_transformer(X_train, y_train, X_val, y_val, scaler):
    model = build_model(n_features=len(FEATURE_NAMES), **FT_CONFIG).to(DEVICE)
    opt   = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS)
    loss_fn = nn.MSELoss()

    Xt = torch.FloatTensor(X_train).to(DEVICE)
    yt = torch.FloatTensor(y_train).to(DEVICE)
    Xv = torch.FloatTensor(X_val).to(DEVICE)
    yv = torch.FloatTensor(y_val).to(DEVICE)

    loader = DataLoader(TensorDataset(Xt, yt), batch_size=BATCH_SIZE, shuffle=True)

    best_val_loss = float('inf')
    patience_ctr  = 0
    best_state    = None

    for epoch in range(1, EPOCHS + 1):
        model.train()
        epoch_loss = 0
        for xb, yb in loader:
            opt.zero_grad()
            loss = loss_fn(model(xb), yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            epoch_loss += loss.item() * len(xb)
        sched.step()

        model.eval()
        with torch.no_grad():
            val_loss = loss_fn(model(Xv), yv).item()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state    = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            patience_ctr  = 0
        else:
            patience_ctr += 1

        if epoch % 10 == 0:
            print(f'  Epoch {epoch:3d} | train_loss={epoch_loss/len(Xt):.3f} | val_loss={val_loss:.3f}')

        if patience_ctr >= PATIENCE:
            print(f'  Early stop at epoch {epoch}')
            break

    model.load_state_dict(best_state)
    model.eval()

    with torch.no_grad():
        val_preds = model(Xv).cpu().numpy()

    mae = mean_absolute_error(y_val, val_preds)
    r2  = r2_score(y_val, val_preds)
    print(f'  FT-Transformer → MAE={mae:.2f}  R²={r2:.4f}')

    torch.save({
        'model_state': best_state,
        'config': FT_CONFIG,
        'n_features': len(FEATURE_NAMES),
        'feature_names': FEATURE_NAMES,
        'val_mae': float(mae),
        'val_r2':  float(r2),
    }, os.path.join(MODELS_DIR, 'ft_transformer.pt'))

    return model, {'mae': float(mae), 'r2': float(r2)}


# ── XGBoost training ──────────────────────────────────────────────────────────
def train_xgboost(X_train, y_train, X_val, y_val):
    xgb_model = xgb.XGBRegressor(**XGB_CONFIG)
    xgb_model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=50,
    )

    val_preds = xgb_model.predict(X_val)
    mae = mean_absolute_error(y_val, val_preds)
    r2  = r2_score(y_val, val_preds)
    print(f'  XGBoost → MAE={mae:.2f}  R²={r2:.4f}')

    xgb_model.save_model(os.path.join(MODELS_DIR, 'xgb_model.json'))
    return xgb_model, {'mae': float(mae), 'r2': float(r2)}


# ── SHAP analysis ─────────────────────────────────────────────────────────────
def compute_shap_background(X_train, xgb_model, n_background=200):
    """Pre-compute SHAP explainer with background data subset."""
    idx = np.random.choice(len(X_train), min(n_background, len(X_train)), replace=False)
    background = X_train[idx]
    explainer = shap.TreeExplainer(xgb_model, background, feature_perturbation='interventional')
    np.save(os.path.join(MODELS_DIR, 'shap_background.npy'), background)
    print(f'  SHAP TreeExplainer ready, background={len(background)} samples')
    return explainer


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', default='../data/student_spending.csv')
    args = parser.parse_args()

    print('📂  Loading data...')
    df = load_data(args.data)
    print(f'    {len(df)} rows | stress_score: mean={df.stress_score.mean():.1f} std={df.stress_score.std():.1f}')

    X = prepare_features(df)
    y = df['stress_score'].values.astype(np.float32)

    # Stratified split
    labels = df['stress_label'].values
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED, stratify=labels)
    X_train, X_val, y_train, y_val   = train_test_split(
        X_train, y_train, test_size=0.15, random_state=SEED)

    print(f'    Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}')

    # Scale features
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_val_s   = scaler.transform(X_val)
    X_test_s  = scaler.transform(X_test)
    joblib.dump(scaler, os.path.join(MODELS_DIR, 'scaler.pkl'))
    print('  ✅ Scaler saved')

    print('\n🧠  Training FT-Transformer...')
    ft_model, ft_metrics = train_ft_transformer(X_train_s, y_train, X_val_s, y_val, scaler)

    print('\n🌳  Training XGBoost...')
    xgb_model, xgb_metrics = train_xgboost(X_train_s, y_train, X_val_s, y_val)

    print('\n🔍  Setting up SHAP...')
    compute_shap_background(X_train_s, xgb_model)

    # Test set evaluation
    print('\n📊  Test set evaluation:')
    ft_model.eval()
    with torch.no_grad():
        ft_test_preds = ft_model(torch.FloatTensor(X_test_s).to(DEVICE)).cpu().numpy()
    xgb_test_preds = xgb_model.predict(X_test_s)

    # Weighted ensemble (FT: 0.45, XGB: 0.55)
    ensemble_preds = 0.45 * ft_test_preds + 0.55 * xgb_test_preds
    ens_mae = mean_absolute_error(y_test, ensemble_preds)
    ens_r2  = r2_score(y_test, ensemble_preds)
    print(f'  Ensemble  → MAE={ens_mae:.2f}  R²={ens_r2:.4f}')

    # Save training report
    report = {
        'ft_transformer': ft_metrics,
        'xgboost':        xgb_metrics,
        'ensemble':       {'mae': float(ens_mae), 'r2': float(ens_r2)},
        'feature_names':  FEATURE_NAMES,
        'n_train':        int(len(X_train)),
        'n_test':         int(len(X_test)),
        'ensemble_weights': {'ft': 0.45, 'xgb': 0.55},
    }
    with open(os.path.join(MODELS_DIR, 'training_report.json'), 'w') as f:
        json.dump(report, f, indent=2)

    print('\n✅  All models saved to ml/models/')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
