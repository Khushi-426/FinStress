# 📊 FinStress v2 — Student Financial Stress Analyser

> Track your daily expenses, set monthly budgets, and get an AI-powered financial stress analysis built entirely from your own spending data — not one-time estimates.

![Stack](https://img.shields.io/badge/Stack-MERN-C9622F?style=flat-square)
![ML](https://img.shields.io/badge/ML-FT--Transformer%20%2B%20XGBoost-3A7D44?style=flat-square)
![Explainability](https://img.shields.io/badge/Explainability-SHAP-C4841A?style=flat-square)
![AI](https://img.shields.io/badge/AI-Claude%20(Anthropic)-2E4057?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.11%2B-blue?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20%2B-green?style=flat-square)

---

## 📋 Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [System Architecture](#system-architecture)
- [ML Models](#ml-models)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Pages & Features](#pages--features)
- [Troubleshooting](#troubleshooting)

---

## Overview

FinStress v2 is a full-stack web application for college students to track daily expenses and understand their financial stress level using machine learning.

**The key difference from a typical finance app:** you log expenses every day first, then click **Run Analysis** to get a stress score. The ML models compute everything from your real spending history — not a form you fill in once.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Recharts, React Router v6 |
| Backend API | Node.js 20, Express 4, Mongoose, JWT |
| Database | MongoDB 7 |
| ML Service | Python 3.11, FastAPI, PyTorch, XGBoost, SHAP |
| AI Chat | Anthropic Claude (claude-sonnet-4) |

---

## How It Works

```
Log expenses daily   →   Set monthly budget   →   Click "Run Analysis"   →   See ML results
   (Tracker page)        (Budget page)             (Analysis page)          from YOUR data
```

1. Add expenses day by day — category, amount, date, note, receipt photo
2. Mark rent/subscriptions as recurring so they appear in a quick-reference strip
3. Set your monthly income and per-category spending targets on the Budget page
4. Hit **Run Analysis** on any month — the backend aggregates your real expense data
5. The FT-Transformer + XGBoost ensemble scores your financial stress (0–100)
6. SHAP explains exactly which spending categories drove the score
7. FinBot (Claude AI) answers questions about your results with full financial context

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              React Frontend  (port 3000)                 │
│  Dashboard · Tracker · Budget · Analysis · FinBot Chat  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API  (JWT auth)
┌──────────────────────▼──────────────────────────────────┐
│             Express API  (port 5000)                     │
│   /expenses  /budget  /analysis/run  /chat  /auth       │
│              ↕ Mongoose ODM                              │
│         MongoDB  (expenses, budgets, analyses, users)   │
└──────────┬───────────────────────────────┬──────────────┘
           │ HTTP axios                    │ Anthropic API
           ▼                              ▼
┌─────────────────────┐      ┌────────────────────────────┐
│ FastAPI ML Service  │      │  Claude  (FinBot context)  │
│     (port 8000)     │      └────────────────────────────┘
│                     │
│  StandardScaler     │
│       ↓             │
│  FT-Transformer     │  45% weight
│  (PyTorch)          │
│       ↓             │
│  XGBoost Regressor  │  55% weight
│       ↓             │
│  Ensemble score     │
│       ↓             │
│  SHAP TreeExplainer │
└─────────────────────┘
```

### Request flow for `/api/analysis/run`

1. React sends `POST /api/analysis/run` with the target month
2. Express queries all `Expense` documents for that month from MongoDB
3. Aggregates totals by category → builds a 24-feature vector
4. Sends feature vector to `POST /predict` on the FastAPI service
5. FastAPI scales features, runs FT-Transformer (PyTorch) + XGBoost
6. Computes SHAP values with `TreeExplainer` on the XGBoost output
7. Returns ensemble score, class probabilities and SHAP waterfall
8. Express generates personalised suggestions, saves `Analysis` document to MongoDB
9. Frontend renders stress rings, SHAP bars, spending charts, suggestions and FinBot chat

---

## ML Models

### FT-Transformer (PyTorch)

A pure PyTorch implementation of the Feature Tokenisation Transformer from [Revisiting Deep Learning Models for Tabular Data](https://arxiv.org/abs/2106.11959) (Gorishniy et al., 2021).

| Hyperparameter | Value |
|---|---|
| `d_token` | 192 — embedding dimension per feature |
| `n_heads` | 8 attention heads |
| `n_layers` | 3 transformer blocks |
| `dropout` | 0.1 |
| `ffn_factor` | 4/3 |
| Optimizer | AdamW, lr=3e-4, weight_decay=1e-4 |
| Scheduler | CosineAnnealingLR |
| Loss | MSELoss on stress score 0–100 |
| Early stopping | patience=15 on validation loss |

**Architecture:** Numerical embedding (linear projection per feature) → prepend `[CLS]` token → 3× TransformerBlock → LayerNorm on CLS output → MLP head → Sigmoid × 100

### XGBoost Regressor

| Hyperparameter | Value |
|---|---|
| `n_estimators` | 500 with early stopping |
| `max_depth` | 6 |
| `learning_rate` | 0.05 |
| `subsample` | 0.8 |
| `colsample_bytree` | 0.8 |
| `reg_alpha / lambda` | 0.1 / 1.0 |
| `eval_metric` | MAE, `early_stopping_rounds=30` |

### Ensemble

```
final_score = 0.45 × FT-Transformer + 0.55 × XGBoost
```

### SHAP Explainability

- `shap.TreeExplainer` on XGBoost with interventional perturbation
- Background set of 200 training samples saved to `ml/models/shap_background.npy`
- Top 12 features by `|SHAP value|` returned to frontend
- Rendered as a waterfall bar chart — red bars increase stress, green bars decrease it

### Feature Engineering (24 features)

**Raw (17):** `age`, `gender_enc`, `year_enc`, `major_enc`, `payment_enc`, `monthly_income`, `financial_aid`, `tuition_monthly`, `housing`, `food`, `transportation`, `books_supplies`, `entertainment`, `personal_care`, `technology`, `health_wellness`, `miscellaneous`

**Derived (7):** `total_income`, `total_expenses`, `savings_gap`, `expense_ratio`, `essential_spend`, `discretionary_spend`, `discretionary_ratio`

> The same derivation logic lives in both `ml/features.py` (Python) and `backend/routes/analysis.js` (Node.js) — keep them in sync.

### Stress Score Formula

```
stress_score = clamp( (expense_ratio − 0.3) / 1.7 × 100,  0,  100 )
```

Where `expense_ratio = total_expenses / total_income`

| Score | Level |
|---|---|
| 0 – 33 | 🟢 Low |
| 33 – 66 | 🟡 Medium |
| 66 – 100 | 🔴 High |

---

## Project Structure

```
finstress2/
├── backend/
│   ├── server.js                   # Express entry — helmet, CORS, rate limit, routes
│   ├── .env                        # Environment variables (copy from .env.example)
│   ├── package.json
│   │
│   ├── middleware/
│   │   └── auth.js                 # JWT Bearer token verification
│   │
│   ├── models/
│   │   ├── User.js                 # name, email, hashed password, profile fields
│   │   ├── Expense.js              # date, category, amount, note, isRecurring, type
│   │   ├── Budget.js               # monthly income + per-category spend targets
│   │   └── Analysis.js             # full ML result — snapshot, SHAP, suggestions
│   │
│   ├── routes/
│   │   ├── auth.js                 # register, login, /me, profile patch
│   │   ├── expenses.js             # CRUD + /summary + /daily aggregation
│   │   ├── budget.js               # GET and PUT monthly budget upsert
│   │   ├── analysis.js             # POST /run — aggregate → ML → save
│   │   └── chat.js                 # FinBot AI chat with financial context
│   │
│   └── ml/
│       ├── features.py             # feature derivation, encoding maps, stress labels
│       ├── ft_transformer.py       # FT-Transformer — NumericalEmbedding, TransformerBlock
│       ├── train.py                # training script — loads CSV, trains, saves artefacts
│       ├── service.py              # FastAPI inference — /predict, /health, /models
│       ├── requirements.txt
│       └── models/                 # created after running train.py
│           ├── ft_transformer.pt
│           ├── xgb_model.json
│           ├── scaler.pkl
│           ├── shap_background.npy
│           └── training_report.json
│
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── App.jsx                 # router — protected routes
        ├── index.css               # global styles + design tokens
        ├── index.js
        │
        ├── context/
        │   └── AuthContext.jsx     # JWT auth state, login/register/logout
        │
        ├── components/
        │   ├── Layout.jsx          # sidebar shell with nav links
        │   ├── MonthNav.jsx        # prev/next month navigator (reused on all pages)
        │   └── ExpenseModal.jsx    # add/edit modal — category grid, receipt upload
        │
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── RegisterPage.jsx
        │   ├── DashboardPage.jsx   # budget vs actual bars, daily chart, trend line
        │   ├── TrackerPage.jsx     # daily expense list — grouped by day, recurring strip
        │   ├── BudgetPage.jsx      # income + per-category targets with live progress bars
        │   └── AnalysisPage.jsx    # 7-tab results: score, SHAP, spending, budget, trends, tips, chat
        │
        └── utils/
            ├── api.js              # Axios instance with error interceptor
            └── categories.js       # category definitions, colours, fmt helpers
```

---

## API Reference

### Express REST API — port 5000

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create account |
| `POST` | `/api/auth/login` | No | Sign in — returns JWT |
| `GET` | `/api/auth/me` | Yes | Current user profile |
| `PATCH` | `/api/auth/profile` | Yes | Update profile fields |
| `POST` | `/api/expenses` | Yes | Add one expense entry |
| `GET` | `/api/expenses?month=&category=` | Yes | List entries with filters |
| `GET` | `/api/expenses/summary?month=` | Yes | Aggregated totals by category |
| `GET` | `/api/expenses/daily?month=` | Yes | Day-by-day spending for chart |
| `PATCH` | `/api/expenses/:id` | Yes | Edit entry |
| `DELETE` | `/api/expenses/:id` | Yes | Delete entry |
| `GET` | `/api/budget?month=` | Yes | Get monthly budget |
| `PUT` | `/api/budget` | Yes | Upsert monthly budget |
| `POST` | `/api/analysis/run` | Yes | Aggregate expenses → run ML → save result |
| `GET` | `/api/analysis/:month` | Yes | Get saved analysis for a month |
| `GET` | `/api/analysis` | Yes | List all analyses (for trend chart) |
| `POST` | `/api/chat` | Yes | FinBot AI chat with financial context |
| `GET` | `/api/health` | No | Health check |

### FastAPI ML Service — port 8000

| Method | Path | Description |
|---|---|---|
| `POST` | `/predict` | Accepts `{features: {...}}` → returns FT, XGB, ensemble scores + SHAP |
| `GET` | `/health` | Model load status, device, feature count |
| `GET` | `/models` | Training report — MAE, R², ensemble weights |

---

## Setup & Installation

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Python 3.11+](https://python.org)
- [MongoDB 7+](https://mongodb.com/try/download/community)

### Step 1 — Clone / extract and open in VS Code

Open the `finstress2/` folder in VS Code, then open the integrated terminal with **Ctrl + `**

### Step 2 — Set up Python environment

```bash
cd finstress2/backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac / Linux

# Install packages (takes 2–5 min — downloads PyTorch, XGBoost, SHAP)
pip install -r ml/requirements.txt
```

> Your terminal prompt should show `(venv)` — this must be active before running any Python commands.

### Step 3 — Train the ML models (once)

```bash
# Copy your Kaggle CSV into finstress2/data/
mkdir ../data
# Drag student_spending.csv into that folder, then:

python ml/train.py --data ../data/student_spending.csv
```

When complete you will see MAE / R² metrics printed and these files created in `ml/models/`:

```
ml/models/
├── ft_transformer.pt
├── xgb_model.json
├── scaler.pkl
├── shap_background.npy
└── training_report.json
```

### Step 4 — Start MongoDB

```bash
mongod                                    # Windows — keep this tab open
brew services start mongodb-community     # Mac
```

Expected output: `waiting for connections on port 27017`

### Step 5 — Start the ML service

```bash
# Still inside backend/ with (venv) active
uvicorn ml.service:app --host 0.0.0.0 --port 8000 --reload
```

Expected output: `Application startup complete.`

### Step 6 — Start the Express API

```bash
# New terminal tab
cd finstress2/backend
npm install
npm run dev
```

Expected output: `✅ MongoDB connected` and `🚀 Server on :5000`

### Step 7 — Start the React frontend

```bash
# New terminal tab
cd finstress2/frontend
npm install
npm start
```

Browser opens automatically at **http://localhost:3000**

---

### Terminal tab summary

You need **4 tabs open** every time you run the app:

| Tab | Command | Directory | Note |
|---|---|---|---|
| 1 | `mongod` | anywhere | Keep running |
| 2 | `uvicorn ml.service:app --host 0.0.0.0 --port 8000 --reload` | `backend/` | Must have `(venv)` active |
| 3 | `npm run dev` | `backend/` | Express API |
| 4 | `npm start` | `frontend/` | React dev server |

> Each time you restart your computer, re-activate the venv in Tab 2 before starting uvicorn.

---

## Environment Variables

Create a `.env` file in `finstress2/backend/` with the following:

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# MongoDB
MONGO_URI=mongodb://localhost:27017/finstress

# JWT — required, must not be empty
JWT_SECRET=your_super_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# Anthropic — only needed for FinBot chat tab
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Python ML service
ML_SERVICE_URL=http://localhost:8000
```

| Variable | Required | Note |
|---|---|---|
| `JWT_SECRET` | ✅ Yes | Any long random string — app won't start without it |
| `MONGO_URI` | ✅ Yes | Default points to local MongoDB |
| `ANTHROPIC_API_KEY` | ⚠️ Optional | Only needed for the FinBot chat tab |
| `ML_SERVICE_URL` | ⚠️ Optional | Defaults to `http://localhost:8000` |
| `PORT` | ⚠️ Optional | Defaults to `5000` |

> **Without `ANTHROPIC_API_KEY`:** everything works except the FinBot chat tab.
>
> **Without the ML service running:** the backend falls back to a rule-based stress score automatically — no crash.

---

## Pages & Features

### 📝 Daily Tracker

- Expenses grouped by day with daily income and spend totals
- Category picker — visual grid of 12 categories with icons and colour highlights
- Recurring flag — recurring entries shown in a quick-reference strip at the top
- Receipt photo — file input with camera capture for mobile
- Filter by any category, income-only, or recurring-only
- Edit and delete on every row

### 🎯 Budget

- Set monthly income and financial aid as separate fields
- Per-category spending targets with live progress bars
- Shows unallocated budget — warns if targets exceed income
- Budget is month-scoped — set different targets each month

### 📊 Dashboard

- Budget vs actual bars — green under budget, amber near limit, red over
- Daily spend bar chart highlighting high-spend days
- Stress score trend line across the last 12 months

### 🔬 Analysis (7 tabs)

| Tab | What it shows |
|---|---|
| **Stress Score** | Three model rings: FT-Transformer, XGBoost, Ensemble. XGB class probability bars |
| **SHAP Explainer** | Waterfall bar chart — red increases stress, green decreases it. Base value + top factors |
| **Spending** | Donut chart of category breakdown with percentages of total |
| **vs Budget** | Horizontal grouped bar chart — your spending vs targets |
| **Trends** | Line chart + monthly history table with score and net gap per month |
| **Suggestions** | Up to 7 rule-based personalised tips with potential monthly savings |
| **FinBot** | Claude AI chat — contextually aware of the selected month's financial data and SHAP factors |

### Fallback mode

If the Python ML service (port 8000) is unreachable, the Express backend automatically falls back to a rule-based stress score:

```
score = clamp((expense_ratio − 0.3) / 1.7 × 100, 0, 100)
```

SHAP values will be empty but all other features (tracker, budget, suggestions, chat) work normally.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `secretOrPrivateKey must have a value` | `JWT_SECRET` missing from `.env` | Add `JWT_SECRET=...` to `backend/.env` |
| `MongoServerError: connect ECONNREFUSED` | MongoDB not running | Run `mongod` in a separate terminal |
| `ML service unavailable` | uvicorn not started or models not trained | Run `train.py` first, then start uvicorn |
| `No data for this month` | No expenses logged yet | Add entries in the Tracker before running analysis |
| `Port already in use` | Previous process still running | Run `npx kill-port 5000` or `npx kill-port 8000` |
| `(venv)` not shown in terminal | Virtual env not activated | Run `venv\Scripts\activate` (Win) or `source venv/bin/activate` (Mac/Linux) |
| `Cannot read properties of undefined (reading 'slice')` | API returned non-array before data loaded | Ensure backend is running on port 5000 and MongoDB is connected |

---

## Dataset

This project was trained on the [Student Spending Dataset](https://www.kaggle.com/) from Kaggle containing 1,000 student records across 18 financial fields. The ML models are trained on this dataset but the app analyses **your own tracked expenses** — the Kaggle data only determines the model weights.

---

## License

MIT
