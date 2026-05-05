"""
features.py — mirrors backend/utils/features.js exactly.
All derived and encoded features used by both training and inference.
"""
import numpy as np
import pandas as pd

FEATURE_NAMES = [
    'age', 'gender_enc', 'year_enc', 'major_enc', 'payment_enc',
    'monthly_income', 'financial_aid', 'tuition_monthly',
    'housing', 'food', 'transportation', 'books_supplies',
    'entertainment', 'personal_care', 'technology', 'health_wellness',
    'miscellaneous',
]

FEATURE_DISPLAY_NAMES = {
    'expense_ratio':        'Expense-to-income ratio',
    'savings_gap':          'Monthly savings gap',
    'total_expenses':       'Total monthly expenses',
    'discretionary_ratio':  'Discretionary spending ratio',
    'entertainment':        'Entertainment spending',
    'housing':              'Housing costs',
    'technology':           'Technology spending',
    'tuition_monthly':      'Monthly tuition cost',
    'food':                 'Food spending',
    'total_income':         'Total monthly income',
    'financial_aid':        'Financial aid received',
    'monthly_income':       'Monthly income',
    'discretionary_spend':  'Discretionary spending',
    'essential_spend':      'Essential spending',
}

YEAR_MAP    = {'Freshman': 1, 'Sophomore': 2, 'Junior': 3, 'Senior': 4}
GENDER_MAP  = {'Male': 0, 'Female': 1, 'Non-binary': 2}
PAYMENT_MAP = {'Credit/Debit Card': 0, 'Cash': 1, 'Mobile Payment App': 2}
MAJOR_MAP   = {'Biology': 0, 'Computer Science': 1, 'Economics': 2, 'Engineering': 3, 'Psychology': 4, 'Other': 5}


def derive_features(row: pd.Series) -> pd.Series:
    """Compute all derived fields from raw Kaggle columns."""
    tuition_monthly    = row.get('tuition', 0) / 12
    total_income       = row.get('monthly_income', 0) + row.get('financial_aid', 0)
    total_expenses     = (
        tuition_monthly
        + row.get('housing', 0) + row.get('food', 0)
        + row.get('transportation', 0) + row.get('books_supplies', 0)
        + row.get('entertainment', 0) + row.get('personal_care', 0)
        + row.get('technology', 0) + row.get('health_wellness', 0)
        + row.get('miscellaneous', 0)
    )
    savings_gap         = total_income - total_expenses
    expense_ratio       = total_expenses / max(total_income, 1)
    essential_spend     = (tuition_monthly + row.get('housing', 0) + row.get('food', 0)
                           + row.get('transportation', 0) + row.get('books_supplies', 0)
                           + row.get('health_wellness', 0))
    discretionary_spend = (row.get('entertainment', 0) + row.get('personal_care', 0)
                           + row.get('technology', 0) + row.get('miscellaneous', 0))
    discretionary_ratio = discretionary_spend / max(total_income, 1)

    return pd.Series({
        'tuition_monthly':    tuition_monthly,
        'total_income':       total_income,
        'total_expenses':     total_expenses,
        'savings_gap':        savings_gap,
        'expense_ratio':      expense_ratio,
        'essential_spend':    essential_spend,
        'discretionary_spend': discretionary_spend,
        'discretionary_ratio': discretionary_ratio,
    })


def encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    """Encode categorical columns to numeric."""
    df = df.copy()
    df['gender_enc']  = df['gender'].map(GENDER_MAP).fillna(0).astype(int)
    df['year_enc']    = df['year_in_school'].map(YEAR_MAP).fillna(1).astype(int)
    df['major_enc']   = df['major'].map(MAJOR_MAP).fillna(0).astype(int)
    df['payment_enc'] = df['preferred_payment_method'].map(PAYMENT_MAP).fillna(0).astype(int)
    return df


def build_stress_label(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute stress score (0-100) and 3-class label.
    Score = clamp((expense_ratio - 0.3) / 1.7 * 100, 0, 100)
    Low < 33, Medium 33-66, High > 66
    """
    df = df.copy()
    df['stress_score'] = ((df['expense_ratio'] - 0.3) / 1.7 * 100).clip(0, 100)
    df['stress_label'] = pd.cut(df['stress_score'], bins=[-1, 33, 66, 101],
                                labels=[0, 1, 2]).astype(int)  # 0=Low,1=Medium,2=High
    return df


def prepare_features(df: pd.DataFrame) -> np.ndarray:
    """Return feature matrix in FEATURE_NAMES order."""
    return df[FEATURE_NAMES].values.astype(np.float32)


def dict_to_feature_vector(feat_dict: dict) -> np.ndarray:
    """Convert a feature dict (from Node.js) to ordered numpy array."""
    return np.array([feat_dict.get(f, 0.0) for f in FEATURE_NAMES], dtype=np.float32)
