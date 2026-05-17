-- CyberNeura Database Migration
-- Run order: 001 (initial schema)

-- ──────────────────────────────────────────────────────────────────────────
-- Scan Logs Table
-- Stores the result of every URL scan for history and analytics
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_logs (
    id              BIGSERIAL PRIMARY KEY,
    scan_id         UUID NOT NULL UNIQUE,
    url             TEXT NOT NULL,
    url_hash        CHAR(64),               -- SHA-256 of normalized URL
    score           SMALLINT NOT NULL CHECK (score >= 0 AND score <= 100),
    level           VARCHAR(10) NOT NULL CHECK (level IN ('SAFE','LOW','MEDIUM','HIGH','CRITICAL')),
    behavioral_flags JSONB DEFAULT '[]',
    ai_score        REAL,
    is_blacklisted  BOOLEAN DEFAULT FALSE,
    is_whitelisted  BOOLEAN DEFAULT FALSE,
    duration_ms     INTEGER,
    client_ip       INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_created_at ON scan_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_logs_level ON scan_logs (level);
CREATE INDEX IF NOT EXISTS idx_scan_logs_url_hash ON scan_logs (url_hash);
CREATE INDEX IF NOT EXISTS idx_scan_logs_score ON scan_logs (score DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- Threat Events Table
-- Stores high-confidence threat detections for alerting and reporting
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threat_events (
    id              BIGSERIAL PRIMARY KEY,
    scan_id         UUID REFERENCES scan_logs(scan_id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    url_hash        CHAR(64),
    threat_level    VARCHAR(10) NOT NULL,
    score           SMALLINT NOT NULL,
    feed_sources    TEXT[],                 -- Which feeds detected this
    gsb_threat_type VARCHAR(64),
    behavioral_flags JSONB DEFAULT '[]',
    resolved        BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_events_created_at ON threat_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_events_threat_level ON threat_events (threat_level);
CREATE INDEX IF NOT EXISTS idx_threat_events_resolved ON threat_events (resolved);

-- ──────────────────────────────────────────────────────────────────────────
-- Feed Sync History Table
-- Tracks when each threat feed was last synced and how many URLs were added
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_sync_history (
    id              BIGSERIAL PRIMARY KEY,
    feed_source     VARCHAR(50) NOT NULL,
    url_count       INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','partial')),
    error_message   TEXT,
    duration_ms     INTEGER,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_sync_history_source ON feed_sync_history (feed_source, synced_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- Analytics View — daily scan summary
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_scan_stats AS
SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS total_scans,
    COUNT(*) FILTER (WHERE level = 'SAFE') AS safe_count,
    COUNT(*) FILTER (WHERE level = 'LOW') AS low_count,
    COUNT(*) FILTER (WHERE level = 'MEDIUM') AS medium_count,
    COUNT(*) FILTER (WHERE level = 'HIGH') AS high_count,
    COUNT(*) FILTER (WHERE level = 'CRITICAL') AS critical_count,
    ROUND(AVG(score), 1) AS avg_score
FROM scan_logs
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
