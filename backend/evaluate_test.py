import os, sys, torch, joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

# Add ml dir to path
sys.path.insert(0, os.path.join(os.getcwd(), 'ml'))
from features import derive_features, encode_categoricals, build_stress_label, prepare_features, FEATURE_NAMES
from ft_transformer import build_model

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

def load_test_data(csv_path):
    df = pd.read_csv(csv_path)
    df.columns = [c.lower().replace(' ', '_').replace('&', 'and').replace('/', '_') for c in df.columns]
    rename = {
        'books_and_supplies': 'books_supplies',
        'health_and_wellness': 'health_wellness',
        'year_in_school': 'year_in_school',
        'preferred_payment_method': 'preferred_payment_method',
    }
    df.rename(columns={k: v for k, v in rename.items() if k in df.columns}, inplace=True)
    df = pd.concat([df, df.apply(derive_features, axis=1)], axis=1)
    df = encode_categoricals(df)
    df = build_stress_label(df)
    
    X = prepare_features(df)
    y = df['stress_score'].values.astype(np.float32)
    labels = df['stress_label'].values
    
    # Same split logic as train.py
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=labels)
    return X_test, y_test

def evaluate():
    print("Loading test data...")
    X_test, y_test = load_test_data('../data/student_spending.csv')
    
    print("Loading models...")
    scaler = joblib.load('ml/models/scaler.pkl')
    X_test_s = scaler.transform(X_test)
    
    # FT-Transformer
    ckpt = torch.load('ml/models/ft_transformer.pt', map_location=DEVICE)
    ft_model = build_model(n_features=ckpt['n_features'], **ckpt['config'])
    ft_model.load_state_dict(ckpt['model_state'])
    ft_model.eval().to(DEVICE)
    
    # XGBoost
    xgb_model = xgb.XGBRegressor()
    xgb_model.load_model('ml/models/xgb_model.json')
    
    print("\n--- TEST SET EVALUATION ---")
    
    # FT
    with torch.no_grad():
        ft_preds = ft_model(torch.FloatTensor(X_test_s).to(DEVICE)).cpu().numpy()
    ft_mae = mean_absolute_error(y_test, ft_preds)
    ft_r2 = r2_score(y_test, ft_preds)
    print(f"FT-Transformer: MAE = {ft_mae:.4f}, R2 = {ft_r2:.4f}")
    
    # XGB
    xgb_preds = xgb_model.predict(X_test_s)
    xgb_mae = mean_absolute_error(y_test, xgb_preds)
    xgb_r2 = r2_score(y_test, xgb_preds)
    print(f"XGBoost:        MAE = {xgb_mae:.4f}, R2 = {xgb_r2:.4f}")
    
    # Ensemble
    ens_preds = 0.45 * ft_preds + 0.55 * xgb_preds
    ens_mae = mean_absolute_error(y_test, ens_preds)
    ens_r2 = r2_score(y_test, ens_preds)
    print(f"Ensemble (45/55): MAE = {ens_mae:.4f}, R2 = {ens_r2:.4f}")

if __name__ == "__main__":
    evaluate()
