"""
CyberNeura — FastAPI AI Microservice
======================================
Serves trained Random Forest and XGBoost models for URL maliciousness
classification. Integrates with the Node.js backend via HTTP.

Endpoints:
  POST /predict         — Score a single URL (0-100)
  POST /predict/batch   — Score up to 100 URLs
  GET  /health          — Service health + model metadata
  GET  /features        — Feature list and descriptions
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Optional, List

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator, ConfigDict
import numpy as np
import joblib

from feature_extractor import extract_features, features_to_vector, FEATURE_NAMES

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("cyberneura-ai")

# ─── Config ─────────────────────────────────────────────────────────────────
MODELS_DIR = Path(__file__).parent / "models"
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "xgb")   # "xgb" or "rf"
MODEL_VERSION = "1.0.0"

# ─── Model Loading ───────────────────────────────────────────────────────────

class ModelRegistry:
    rf: object = None
    xgb: object = None
    meta: dict = {}

    def load(self):
        errors = []

        # Load Random Forest
        rf_path = MODELS_DIR / "rf_model.joblib"
        if rf_path.exists():
            try:
                self.rf = joblib.load(rf_path)
                log.info(f"✅ Random Forest loaded: {rf_path}")
            except Exception as e:
                errors.append(f"RF load failed: {e}")
        else:
            errors.append(f"RF model not found at {rf_path}")

        # Load XGBoost
        xgb_path = MODELS_DIR / "xgb_model.joblib"
        if xgb_path.exists():
            try:
                self.xgb = joblib.load(xgb_path)
                log.info(f"✅ XGBoost loaded: {xgb_path}")
            except Exception as e:
                errors.append(f"XGB load failed: {e}")
        else:
            errors.append(f"XGB model not found at {xgb_path}")

        # Load metadata
        meta_path = MODELS_DIR / "model_meta.json"
        if meta_path.exists():
            with open(meta_path) as f:
                self.meta = json.load(f)

        if not self.rf and not self.xgb:
            log.error("No models available. Run: python trainer.py")
            log.error("\n".join(errors))
        else:
            log.info(f"Model registry ready. Errors: {errors or 'none'}")


registry = ModelRegistry()

# ─── FastAPI App ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    registry.load()
    yield

app = FastAPI(
    title="CyberNeura AI Service",
    description="Phishing & malicious URL classification using Random Forest + XGBoost",
    version=MODEL_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ─── Request / Response Models ───────────────────────────────────────────────

class PredictRequest(BaseModel):
    url: str
    features: Optional[dict] = None   # Pre-computed features from Node.js
    model: Optional[str] = None       # "rf", "xgb", or None (uses PRIMARY_MODEL)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("URL cannot be empty")
        if len(v) > 4096:
            raise ValueError("URL too long (max 4096 chars)")
        return v


class BatchPredictRequest(BaseModel):
    urls: List[str]

    @field_validator("urls")
    @classmethod
    def validate_urls(cls, v):
        if not v:
            raise ValueError("urls list cannot be empty")
        if len(v) > 100:
            raise ValueError("Max 100 URLs per batch")
        return [u.strip() for u in v if u.strip()]


class PredictResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    url: str
    score: float             # 0.0 – 100.0
    probability: float       # Raw model probability (0.0 – 1.0)
    prediction: str          # "malicious" | "benign"
    confidence: float        # Confidence of prediction
    model_used: str
    model_version: str
    features_used: int


# ─── Prediction Logic ────────────────────────────────────────────────────────

def _get_model(model_name: Optional[str]):
    """Resolve model name to loaded model object."""
    name = (model_name or PRIMARY_MODEL).lower()
    if name == "xgb" and registry.xgb:
        return registry.xgb, "xgboost"
    if name == "rf" and registry.rf:
        return registry.rf, "random_forest"
    # Fallback
    if registry.xgb:
        return registry.xgb, "xgboost"
    if registry.rf:
        return registry.rf, "random_forest"
    raise HTTPException(
        status_code=503,
        detail="No models loaded. Run `python trainer.py` first."
    )


def _predict_url(url: str, model_name: Optional[str] = None) -> dict:
    model, model_label = _get_model(model_name)

    # Extract features
    feat_dict = extract_features(url)
    vector = np.array([features_to_vector(feat_dict)], dtype=np.float32)

    # Predict
    prob_malicious = float(model.predict_proba(vector)[0][1])
    prediction = "malicious" if prob_malicious >= 0.5 else "benign"
    confidence = prob_malicious if prediction == "malicious" else (1.0 - prob_malicious)

    # Scale to 0-100
    score = round(prob_malicious * 100, 1)

    return {
        "url": url,
        "score": score,
        "probability": round(prob_malicious, 4),
        "prediction": prediction,
        "confidence": round(confidence, 4),
        "model_used": model_label,
        "model_version": MODEL_VERSION,
        "features_used": len(FEATURE_NAMES),
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(req: PredictRequest):
    """
    Score a single URL. Returns a maliciousness score 0-100.

    - **score=0** → clearly benign
    - **score=100** → clearly malicious
    - **threshold=50** → classification boundary
    """
    try:
        result = _predict_url(req.url, req.model)
        log.debug(f"Predicted {req.url[:80]} → {result['score']:.1f} ({result['prediction']})")
        return result
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Prediction error for {req.url}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch", tags=["Prediction"])
async def predict_batch(req: BatchPredictRequest):
    """Score up to 100 URLs in a single request."""
    results = []
    errors = []
    for url in req.urls:
        try:
            results.append(_predict_url(url))
        except Exception as e:
            errors.append({"url": url, "error": str(e)})

    return {
        "total": len(req.urls),
        "success": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }


@app.get("/health", tags=["Health"])
async def health():
    """System health — reports which models are loaded and their metrics."""
    models_status = {
        "random_forest": {
            "loaded": registry.rf is not None,
            "path": str(MODELS_DIR / "rf_model.joblib"),
        },
        "xgboost": {
            "loaded": registry.xgb is not None,
            "path": str(MODELS_DIR / "xgb_model.joblib"),
        },
    }

    # Attach training metrics from metadata
    for m in registry.meta.get("models", []):
        key = "random_forest" if "Random" in m["name"] else "xgboost"
        if key in models_status:
            models_status[key]["metrics"] = {
                k: v for k, v in m.items() if k != "name"
            }

    return {
        "healthy": registry.rf is not None or registry.xgb is not None,
        "version": MODEL_VERSION,
        "primary_model": PRIMARY_MODEL,
        "n_features": len(FEATURE_NAMES),
        "trained_at": registry.meta.get("trained_at"),
        "n_training_samples": registry.meta.get("n_samples"),
        "datasets": registry.meta.get("datasets", []),
        "models": models_status,
    }


@app.get("/features", tags=["Info"])
async def features():
    """List all 25 URL features used by the models."""
    return {
        "n_features": len(FEATURE_NAMES),
        "features": [
            {"name": f, "index": i}
            for i, f in enumerate(FEATURE_NAMES)
        ],
    }
