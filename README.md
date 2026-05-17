# CyberNeura 🛡️

**Enterprise-grade, AI-powered phishing and malicious URL detection system.**

---

## Architecture

```
cyberneura/                        (monorepo)
├── backend/                       (Node.js + Express)
│   └── src/
│       ├── config/                redis.js, postgres.js, env.js
│       ├── controllers/           scan.controller.js   ← Core pipeline
│       ├── routes/                scan.routes.js, health.routes.js
│       ├── services/
│       │   ├── urlExtractor.service.js   ← Regex + Cheerio HTML parsing
│       │   ├── behavioralAnalysis.service.js  ← 12 heuristic signals
│       │   ├── riskScoring.service.js    ← Weighted 0-100 scoring
│       │   └── aiStub.service.js         ← FastAPI HTTP stub
│       ├── threatIntel/
│       │   ├── feeds/
│       │   │   ├── phishTank.feed.js
│       │   │   ├── openPhish.feed.js
│       │   │   ├── urlhaus.feed.js
│       │   │   └── googleSafeBrowsing.feed.js
│       │   ├── feedManager.js      ← Parallel fetch + dedup
│       │   ├── redisCache.service.js ← O(1) blacklist/whitelist
│       │   └── cacheSync.worker.js   ← Cron: every 30 min
│       ├── db/
│       │   ├── migrations/001_init.sql
│       │   └── postgres.js
│       ├── middleware/             rateLimiter.js, errorHandler.js
│       └── utils/                 logger.js, hashUtils.js
├── frontend/                      (React 18 + Vite + Tailwind)
│   └── src/
│       ├── api/scan.api.js
│       ├── store/useAppStore.js   ← Zustand
│       ├── components/
│       │   ├── Layout/            Sidebar.jsx, Header.jsx
│       │   ├── Scanner/           UrlScanner.jsx, EmailParser.jsx
│       │   ├── Results/           ThreatResult.jsx, ThreatBadge.jsx
│       │   ├── Analytics/         ThreatChart.jsx
│       │   └── Notifications/     AlertBanner.jsx
│       └── pages/                 Dashboard, Scanner, EmailParser, Analytics
├── docker-compose.yml
└── .env.example
```

## Scan Pipeline

```
URL Input
  └─► 1. Whitelist Check (Redis Set — O(1)) → SHORT-CIRCUIT if trusted
        └─► 2. Blacklist Check (Redis Set — O(1)) → score=100 if hit
              └─► 3. Google Safe Browsing API (real-time lookup)
                    └─► 4. Behavioral Analysis (entropy, length, TLD, punycode...)
                          └─► 5. AI Stub (FastAPI microservice, optional)
                                └─► 6. Weighted Risk Score (0-100)
                                      └─► 7. Log to PostgreSQL
```

## Quick Start

### 1. Prerequisites
- Docker & Docker Compose
- Node.js ≥ 18
- (Optional) Python 3.10+ for the AI microservice

### 2. Environment setup
```bash
cp .env.example .env
# Fill in your API keys (GSB, PhishTank)
```

### 3. Start with Docker (recommended)
```bash
docker-compose up -d   # Redis + PostgreSQL + backend + frontend
```

### 4. OR run locally
```bash
# Terminal 1 — Infrastructure
docker-compose up -d redis postgres

# Terminal 2 — Backend
cd backend
npm install
npm run dev            # http://localhost:4000

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### 5. Run database migrations
```bash
# Migrations auto-run via docker-compose, or manually:
psql $DATABASE_URL -f backend/src/db/migrations/001_init.sql
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/scan/url` | Scan a single URL |
| `POST` | `/api/v1/scan/bulk` | Scan up to 20 URLs |
| `POST` | `/api/v1/scan/email` | Parse email/HTML + scan all URLs |
| `GET`  | `/api/v1/scan/history` | Paginated scan history |
| `GET`  | `/api/v1/health` | System health (Redis, Postgres, AI) |

### Example — Scan URL
```bash
curl -X POST http://localhost:4000/api/v1/scan/url \
  -H "Content-Type: application/json" \
  -d '{"url": "http://paypal-secure-login.tk/verify?token=abc123"}'
```

### Example Response
```json
{
  "success": true,
  "data": {
    "scanId": "uuid",
    "url": "http://paypal-secure-login.tk/verify?token=abc123",
    "score": 87,
    "level": "CRITICAL",
    "recommendation": "🚨 BLOCK IMMEDIATELY...",
    "signalBreakdown": [
      { "source": "Behavioral Analysis", "score": 40, "note": "Flags: HIGH_RISK_TLD, BRAND_IMPERSONATION, SUSPICIOUS_KEYWORD" }
    ]
  }
}
```

## Threat Scoring

| Score | Level | Meaning |
|-------|-------|---------|
| 0–19  | SAFE | No threats detected |
| 20–39 | LOW | Minor anomalies |
| 40–64 | MEDIUM | Behavioral suspicion |
| 65–84 | HIGH | Strong threat indicators |
| 85–100 | CRITICAL | Confirmed threat / blacklisted |

## Feed Sync

The cron worker runs on startup and then every 30 minutes:
- Fetches PhishTank JSON dump
- Fetches OpenPhish plain-text feed  
- Fetches URLhaus text feed
- Deduplicates all URLs
- Pipeline-inserts SHA-256 hashes into Redis Set

Google Safe Browsing is called per-URL during scan (not bulk cached).

## API Keys Required

| Feed | Key Required | Where to get |
|------|--------------|--------------|
| Google Safe Browsing | Yes | [GSB Console](https://developers.google.com/safe-browsing/v4/get-started) |
| PhishTank | Optional (higher rate limit) | [PhishTank API](https://www.phishtank.com/api_info.php) |
| OpenPhish | No | Public feed |
| URLhaus | No | Public feed |

## AI Microservice (Stub)

Set `AI_SERVICE_ENABLED=true` and `AI_SERVICE_URL=http://your-fastapi:8000`.

Expected contract:
```
POST /predict
Body: { "url": "...", "features": { "entropy": 4.2, "urlLength": 120, "flagCount": 3 } }
Response: { "score": 72.5, "confidence": 0.91, "model_version": "1.2.0" }
```
