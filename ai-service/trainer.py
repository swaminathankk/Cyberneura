"""
CyberNeura — ML Model Trainer
================================
Trains Random Forest and XGBoost classifiers on multiple public
phishing/malicious URL datasets.

Datasets used:
  1. ISCX-URL-2016 (Kaggle mirror via GitHub) — "benign" + "phishing" labels
  2. Phishing URL Dataset by Faizann24 (GitHub) — "bad" / "good" labels
  3. URLhaus active malware URLs (live pull via abuse.ch)
  4. Curated benign URL list (Alexa / Tranco top domains)
  5. Synthetic augmentation based on known phishing patterns

Output:
  - models/rf_model.joblib
  - models/xgb_model.joblib
  - models/model_meta.json   ← version, features, accuracy metrics
"""

import os
import sys
import json
import logging
import warnings
from typing import Optional, List
import requests
import numpy as np
import pandas as pd
from io import StringIO
from pathlib import Path
from datetime import datetime

# ML
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix, classification_report,
)
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False
    print("⚠️  XGBoost not installed. Install with: pip install xgboost")

from feature_extractor import extract_features, features_to_vector, FEATURE_NAMES

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("trainer")

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

TIMEOUT = 30  # seconds for HTTP requests

# ─── Dataset Loaders ────────────────────────────────────────────────────────

def _fetch_text(url: str, desc: str) -> Optional[str]:
    """Fetch a URL as text with graceful failure."""
    try:
        log.info(f"  Downloading: {desc}")
        r = requests.get(url, timeout=TIMEOUT, headers={
            "User-Agent": "CyberNeura-Trainer/1.0 (Security Research)"
        })
        r.raise_for_status()
        return r.text
    except Exception as e:
        log.warning(f"  ❌ Failed to fetch {desc}: {e}")
        return None


def load_faizann24_dataset() -> pd.DataFrame:
    """
    Phishing URLs dataset by Faizann24.
    ~450K URLs labelled 'bad' (phishing/malware) or 'good' (benign).
    Source: https://github.com/faizann24/Using-machine-learning-to-detect-malicious-URLs
    """
    url = "https://raw.githubusercontent.com/faizann24/Using-machine-learning-to-detect-malicious-URLs/master/data/data.csv"
    text = _fetch_text(url, "Faizann24 URL dataset (450K URLs)")
    if text is None:
        return pd.DataFrame()
    try:
        df = pd.read_csv(StringIO(text))
        df = df.rename(columns={"url": "url", "label": "label"})
        df["label"] = df["label"].map({"bad": 1, "good": 0})
        df = df.dropna(subset=["url", "label"])
        log.info(f"  ✅ Faizann24: {len(df):,} URLs loaded "
                 f"(malicious: {int(df['label'].sum()):,}, "
                 f"benign: {int((df['label']==0).sum()):,})")
        return df[["url", "label"]]
    except Exception as e:
        log.warning(f"  ❌ Failed to parse Faizann24 dataset: {e}")
        return pd.DataFrame()


def load_urlhaus_dataset() -> pd.DataFrame:
    """
    URLhaus active malware distribution URLs — all labelled malicious (1).
    Paired with synthetic benign URLs to balance.
    """
    url = "https://urlhaus.abuse.ch/downloads/text/"
    text = _fetch_text(url, "URLhaus malware URLs")
    if text is None:
        return pd.DataFrame()
    try:
        urls = [
            line.strip()
            for line in text.splitlines()
            if line.strip() and not line.startswith("#")
               and line.strip().startswith("http")
        ]
        df = pd.DataFrame({"url": urls, "label": 1})
        log.info(f"  ✅ URLhaus: {len(df):,} malware URLs loaded")
        return df
    except Exception as e:
        log.warning(f"  ❌ URLhaus parse error: {e}")
        return pd.DataFrame()


def load_openphish_dataset() -> pd.DataFrame:
    """OpenPhish community feed — all phishing URLs (label=1)."""
    url = "https://openphish.com/feed.txt"
    text = _fetch_text(url, "OpenPhish phishing URLs")
    if text is None:
        return pd.DataFrame()
    try:
        urls = [
            line.strip() for line in text.splitlines()
            if line.strip().startswith("http")
        ]
        df = pd.DataFrame({"url": urls, "label": 1})
        log.info(f"  ✅ OpenPhish: {len(df):,} phishing URLs loaded")
        return df
    except Exception as e:
        log.warning(f"  ❌ OpenPhish parse error: {e}")
        return pd.DataFrame()


def generate_synthetic_dataset(n_benign: int = 5000, n_malicious: int = 5000) -> pd.DataFrame:
    """
    Generate realistic synthetic URLs to supplement smaller live feeds.
    This covers known phishing patterns not always present in live feeds at
    the moment of training.
    """
    import random
    import string

    rng = random.Random(42)

    benign_domains = [
        "google.com", "youtube.com", "facebook.com", "amazon.com",
        "wikipedia.org", "reddit.com", "twitter.com", "linkedin.com",
        "github.com", "stackoverflow.com", "nytimes.com", "bbc.com",
        "microsoft.com", "apple.com", "netflix.com", "spotify.com",
        "dropbox.com", "salesforce.com", "adobe.com", "oracle.com",
    ]

    benign_paths = [
        "/", "/about", "/contact", "/products", "/blog",
        "/search?q=hello", "/user/profile", "/docs/api",
        "/news/article/2024", "/shop/checkout",
    ]

    benign_rows = []
    for _ in range(n_benign):
        domain = rng.choice(benign_domains)
        path = rng.choice(benign_paths)
        scheme = rng.choice(["https"] * 9 + ["http"])
        benign_rows.append(f"{scheme}://{domain}{path}")

    # Malicious URL patterns
    suspicious_tlds = ["tk", "ml", "ga", "cf", "xyz", "top", "icu", "buzz", "link"]
    brands = ["paypal", "apple", "microsoft", "amazon", "facebook", "netflix"]
    suspicious_words = ["login", "verify", "secure", "update", "account", "confirm"]

    def rand_string(n):
        return "".join(rng.choices(string.ascii_lowercase + string.digits, k=n))

    malicious_rows = []
    for _ in range(n_malicious):
        pattern = rng.randint(1, 6)
        if pattern == 1:
            # Brand impersonation subdomain
            brand = rng.choice(brands)
            tld = rng.choice(suspicious_tlds)
            word = rng.choice(suspicious_words)
            url = f"http://{brand}-{word}.{rand_string(6)}.{tld}/account/{rand_string(8)}"
        elif pattern == 2:
            # IP address host with long path
            ip = f"{rng.randint(1,254)}.{rng.randint(1,254)}.{rng.randint(1,254)}.{rng.randint(1,254)}"
            url = f"http://{ip}:{rng.randint(1024,9999)}/{rand_string(20)}.php"
        elif pattern == 3:
            # High entropy random domain
            domain = f"{rand_string(rng.randint(12, 20))}.{rng.choice(suspicious_tlds)}"
            url = f"http://{domain}/{rand_string(15)}?token={rand_string(30)}"
        elif pattern == 4:
            # Punycode domain
            url = f"http://xn--{rand_string(8)}.com/secure/{rand_string(10)}"
        elif pattern == 5:
            # Deep subdomain
            brand = rng.choice(brands)
            subs = ".".join([rand_string(5) for _ in range(rng.randint(3, 5))])
            url = f"http://{brand}.{subs}.{rng.choice(suspicious_tlds)}/"
        else:
            # @ symbol obfuscation
            url = f"http://trusted-site.com@{rand_string(10)}.{rng.choice(suspicious_tlds)}/login"

        malicious_rows.append(url)

    df_benign = pd.DataFrame({"url": benign_rows, "label": 0})
    df_malicious = pd.DataFrame({"url": malicious_rows, "label": 1})
    df = pd.concat([df_benign, df_malicious], ignore_index=True).sample(frac=1, random_state=42)
    log.info(f"  ✅ Synthetic: {n_benign:,} benign + {n_malicious:,} malicious URLs generated")
    return df


# ─── Feature Extraction ──────────────────────────────────────────────────────

def extract_feature_matrix(urls: List[str]) -> np.ndarray:
    """
    Extract feature vectors for a list of URLs.
    Shows a progress indicator every 10K URLs.
    """
    vectors = []
    total = len(urls)
    for i, url in enumerate(urls):
        if i % 10000 == 0 and i > 0:
            log.info(f"    Extracting features: {i:,}/{total:,} ({100*i//total}%)")
        feat = extract_features(url)
        vectors.append(features_to_vector(feat))
    return np.array(vectors, dtype=np.float32)


# ─── Metrics Reporter ────────────────────────────────────────────────────────

def evaluate_model(model, X_test: np.ndarray, y_test: np.ndarray, name: str) -> dict:
    """Evaluate a trained model and print a detailed report."""
    y_pred = model.predict(X_test)

    try:
        if hasattr(model, "predict_proba"):
            y_prob = model.predict_proba(X_test)[:, 1]
        else:
            y_prob = model.predict(X_test)
        auc = roc_auc_score(y_test, y_prob)
    except Exception:
        auc = None

    metrics = {
        "name": name,
        "accuracy":  round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1":        round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "roc_auc":   round(float(auc), 4) if auc else None,
    }

    cm = confusion_matrix(y_test, y_pred)

    print(f"\n{'='*60}")
    print(f"  📊 {name} — Evaluation Results")
    print(f"{'='*60}")
    print(f"  Accuracy:   {metrics['accuracy']:.4f}  ({metrics['accuracy']*100:.2f}%)")
    print(f"  Precision:  {metrics['precision']:.4f}")
    print(f"  Recall:     {metrics['recall']:.4f}")
    print(f"  F1 Score:   {metrics['f1']:.4f}")
    if auc:
        print(f"  ROC-AUC:    {metrics['roc_auc']:.4f}")
    print(f"\n  Confusion Matrix:")
    print(f"    TN={cm[0,0]:,}  FP={cm[0,1]:,}")
    print(f"    FN={cm[1,0]:,}  TP={cm[1,1]:,}")
    print(f"\n  Classification Report:")
    print(classification_report(y_test, y_pred,
                                target_names=["Benign", "Malicious"],
                                digits=4))

    return metrics


# ─── Main Training Pipeline ─────────────────────────────────────────────────

def train():
    print("\n" + "="*60)
    print("  🤖 CyberNeura — ML Model Training Pipeline")
    print("="*60)

    # ── 1. Load Datasets ──────────────────────────────────────
    print("\n📥 Loading datasets...\n")
    frames = []

    df1 = load_faizann24_dataset()
    if not df1.empty:
        # Sample up to 200K from this large dataset for speed
        df1 = df1.sample(min(len(df1), 200_000), random_state=42)
        frames.append(df1)

    df2 = load_urlhaus_dataset()
    if not df2.empty:
        frames.append(df2)

    df3 = load_openphish_dataset()
    if not df3.empty:
        frames.append(df3)

    # Always include synthetic data
    df4 = generate_synthetic_dataset(n_benign=10_000, n_malicious=10_000)
    frames.append(df4)

    if not frames:
        log.error("No datasets loaded. Check network connectivity.")
        sys.exit(1)

    df = pd.concat(frames, ignore_index=True)
    df = df.dropna(subset=["url", "label"])
    df["url"] = df["url"].astype(str).str.strip()
    df["label"] = df["label"].astype(int)
    df = df[df["url"].str.startswith("http")]
    df = df.drop_duplicates(subset=["url"])
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"\n📊 Combined dataset: {len(df):,} URLs")
    print(f"   Malicious:  {int(df['label'].sum()):,} ({100*df['label'].mean():.1f}%)")
    print(f"   Benign:     {int((df['label']==0).sum()):,} ({100*(1-df['label'].mean()):.1f}%)")

    # ── 2. Feature Extraction ─────────────────────────────────
    print(f"\n⚙️  Extracting {len(FEATURE_NAMES)} features from {len(df):,} URLs...")
    X = extract_feature_matrix(df["url"].tolist())
    y = df["label"].values

    print(f"   Feature matrix shape: {X.shape}")
    print(f"   Features: {', '.join(FEATURE_NAMES)}")

    # ── 3. Train/Test Split ───────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"\n📂 Split: {len(X_train):,} train | {len(X_test):,} test (80/20, stratified)")

    all_metrics = []

    # ── 4. Random Forest ──────────────────────────────────────
    print("\n🌲 Training Random Forest Classifier...")
    print("   Parameters: n_estimators=200, max_depth=None, n_jobs=-1")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_split=5,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)

    rf_metrics = evaluate_model(rf, X_test, y_test, "Random Forest")
    all_metrics.append(rf_metrics)

    # Cross-validation (5-fold)
    print("  Running 5-fold cross-validation on Random Forest...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf, X, y, cv=cv, scoring="f1", n_jobs=-1)
    print(f"  CV F1 scores: {[round(s,4) for s in cv_scores]}")
    print(f"  CV F1 mean ± std: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    rf_metrics["cv_f1_mean"] = round(float(cv_scores.mean()), 4)
    rf_metrics["cv_f1_std"]  = round(float(cv_scores.std()), 4)

    # Feature importances
    importances = sorted(
        zip(FEATURE_NAMES, rf.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    print("\n  🎯 Top-10 Feature Importances (Random Forest):")
    for feat, imp in importances[:10]:
        bar = "█" * int(imp * 50)
        print(f"    {feat:<30} {imp:.4f}  {bar}")

    # Save RF model
    rf_path = MODELS_DIR / "rf_model.joblib"
    joblib.dump(rf, rf_path)
    print(f"\n  💾 Saved: {rf_path}")

    # ── 5. XGBoost ────────────────────────────────────────────
    if XGB_AVAILABLE:
        print("\n⚡ Training XGBoost Classifier...")
        scale_pos_weight = float((y_train == 0).sum()) / float((y_train == 1).sum())
        print(f"   Parameters: n_estimators=300, max_depth=6, scale_pos_weight={scale_pos_weight:.2f}")

        xgb_model = xgb.XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
            verbosity=0,
        )
        xgb_model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False,
        )

        xgb_metrics = evaluate_model(xgb_model, X_test, y_test, "XGBoost")
        all_metrics.append(xgb_metrics)

        # XGBoost feature importances
        imp_dict = dict(zip(FEATURE_NAMES, xgb_model.feature_importances_))
        xgb_top = sorted(imp_dict.items(), key=lambda x: x[1], reverse=True)
        print("\n  🎯 Top-10 Feature Importances (XGBoost):")
        for feat, imp in xgb_top[:10]:
            bar = "█" * int(imp * 50)
            print(f"    {feat:<30} {imp:.4f}  {bar}")

        xgb_path = MODELS_DIR / "xgb_model.joblib"
        joblib.dump(xgb_model, xgb_path)
        print(f"\n  💾 Saved: {xgb_path}")

    # ── 6. Model Comparison Summary ───────────────────────────
    print("\n" + "="*60)
    print("  📊 MODEL COMPARISON SUMMARY")
    print("="*60)
    print(f"  {'Model':<20} {'Accuracy':>10} {'F1':>8} {'AUC':>8} {'Precision':>10} {'Recall':>8}")
    print(f"  {'-'*66}")
    for m in all_metrics:
        auc_str = f"{m['roc_auc']:.4f}" if m.get("roc_auc") else "  N/A  "
        print(f"  {m['name']:<20} {m['accuracy']:>10.4f} {m['f1']:>8.4f} "
              f"{auc_str:>8} {m['precision']:>10.4f} {m['recall']:>8.4f}")

    # ── 7. Save Metadata ──────────────────────────────────────
    meta = {
        "version": "1.0.0",
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "n_samples": int(len(df)),
        "n_features": len(FEATURE_NAMES),
        "feature_names": FEATURE_NAMES,
        "datasets": [
            "Faizann24 ML-URLs (GitHub)",
            "URLhaus (abuse.ch)",
            "OpenPhish Community",
            "Synthetic Augmentation",
        ],
        "models": all_metrics,
        "primary_model": "xgb" if XGB_AVAILABLE else "rf",
    }
    meta_path = MODELS_DIR / "model_meta.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n  💾 Metadata saved: {meta_path}")
    print("\n✅ Training complete!\n")
    return meta


if __name__ == "__main__":
    train()
