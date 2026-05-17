'use strict';

/**
 * Risk Scoring Service
 *
 * Aggregates signals from multiple sources into a final risk score (0-100)
 * and a human-readable threat level.
 *
 * Signal weights:
 * ┌─────────────────────────────────┬────────────────────────────────────┐
 * │ Signal                          │ Score contribution                 │
 * ├─────────────────────────────────┼────────────────────────────────────┤
 * │ Redis blacklist hit             │ 100 (immediate CRITICAL)           │
 * │ Google Safe Browsing match      │ 90   (CRITICAL)                    │
 * │ PhishTank verified              │ 90   (CRITICAL)                    │
 * │ URLhaus match                   │ 85   (HIGH)                        │
 * │ OpenPhish match                 │ 85   (HIGH)                        │
 * │ Behavioral score (0-100)        │ 0-40 (scaled to 40% of total)      │
 * │ AI model score (0-100)          │ 0-30 (scaled to 30% of total)      │
 * └─────────────────────────────────┴────────────────────────────────────┘
 */

const THREAT_LEVELS = {
    SAFE: { label: 'SAFE', color: 'green', minScore: 0 },
    LOW: { label: 'LOW', color: 'yellow', minScore: 20 },
    MEDIUM: { label: 'MEDIUM', color: 'orange', minScore: 40 },
    HIGH: { label: 'HIGH', color: 'red', minScore: 65 },
    CRITICAL: { label: 'CRITICAL', color: 'purple', minScore: 85 },
};

function getThreatLevel(score) {
    if (score >= 85) return THREAT_LEVELS.CRITICAL;
    if (score >= 65) return THREAT_LEVELS.HIGH;
    if (score >= 40) return THREAT_LEVELS.MEDIUM;
    if (score >= 20) return THREAT_LEVELS.LOW;
    return THREAT_LEVELS.SAFE;
}

/**
 * Calculate the final risk score from all available signals.
 *
 * @param {{
 *   isWhitelisted?: boolean,
 *   isBlacklisted?: boolean,
 *   gsbResult?: { isThreat: boolean, threatType?: string },
 *   behavioralScore?: number,
 *   behavioralFlags?: string[],
 *   aiScore?: number,
 *   hiddenLinksFound?: boolean,
 * }} signals
 *
 * @returns {{
 *   score: number,
 *   level: string,
 *   color: string,
 *   recommendation: string,
 *   signalBreakdown: Object[],
 * }}
 */
function calculateRiskScore(signals) {
    const {
        isWhitelisted = false,
        isBlacklisted = false,
        gsbResult = null,
        behavioralScore = 0,
        behavioralFlags = [],
        aiScore = null,
        hiddenLinksFound = false,
    } = signals;

    const signalBreakdown = [];
    let finalScore = 0;

    // Short-circuit: whitelisted domains get score 0
    if (isWhitelisted) {
        return {
            score: 0,
            level: 'SAFE',
            color: 'green',
            recommendation: 'URL is on the trusted whitelist.',
            signalBreakdown: [{ source: 'Whitelist', score: 0, note: 'Domain is whitelisted' }],
        };
    }

    // Blacklist hit — immediate CRITICAL, no further calculation needed
    if (isBlacklisted) {
        finalScore = 100;
        signalBreakdown.push({
            source: 'Redis Blacklist',
            score: 100,
            note: 'URL found in local threat intelligence blacklist',
        });
        const level = getThreatLevel(finalScore);
        return {
            score: finalScore,
            level: level.label,
            color: level.color,
            recommendation: buildRecommendation(level.label),
            signalBreakdown,
        };
    }

    // Google Safe Browsing
    if (gsbResult?.isThreat) {
        const gsbScore = 90;
        finalScore = Math.max(finalScore, gsbScore);
        signalBreakdown.push({
            source: 'Google Safe Browsing',
            score: gsbScore,
            note: `Threat type: ${gsbResult.threatType || 'UNKNOWN'}`,
        });
    } else if (gsbResult !== null) {
        signalBreakdown.push({ source: 'Google Safe Browsing', score: 0, note: 'No match' });
    }

    // Behavioral analysis (weight: 40%)
    if (behavioralScore > 0) {
        const weightedBehavioral = Math.round(behavioralScore * 0.40);
        finalScore = Math.min(100, finalScore + weightedBehavioral);
        signalBreakdown.push({
            source: 'Behavioral Analysis',
            score: weightedBehavioral,
            note: behavioralFlags.length > 0
                ? `Flags: ${behavioralFlags.slice(0, 5).join(', ')}${behavioralFlags.length > 5 ? '...' : ''}`
                : 'No flags',
        });
    }

    // AI model score (weight: 30%)
    if (aiScore !== null && aiScore !== undefined) {
        const weightedAi = Math.round(aiScore * 0.30);
        finalScore = Math.min(100, finalScore + weightedAi);
        signalBreakdown.push({
            source: 'AI Model',
            score: weightedAi,
            note: `Raw AI score: ${aiScore}`,
        });
    } else {
        signalBreakdown.push({ source: 'AI Model', score: 0, note: 'Service not available' });
    }

    // Hidden links bonus
    if (hiddenLinksFound) {
        finalScore = Math.min(100, finalScore + 15);
        signalBreakdown.push({ source: 'Hidden Links', score: 15, note: 'Hidden/invisible URLs detected' });
    }

    const level = getThreatLevel(finalScore);

    return {
        score: finalScore,
        level: level.label,
        color: level.color,
        recommendation: buildRecommendation(level.label),
        signalBreakdown,
    };
}

function buildRecommendation(level) {
    switch (level) {
        case 'CRITICAL':
            return '🚨 BLOCK IMMEDIATELY — URL matches known threat feeds. Do not visit.';
        case 'HIGH':
            return '⛔ HIGH RISK — Multiple threat signals detected. Strongly advise blocking.';
        case 'MEDIUM':
            return '⚠️ SUSPICIOUS — Behavioral anomalies detected. Proceed with extreme caution.';
        case 'LOW':
            return '🔶 LOW RISK — Minor anomalies detected. Exercise caution.';
        case 'SAFE':
        default:
            return '✅ SAFE — No threats detected.';
    }
}

module.exports = { calculateRiskScore, getThreatLevel, THREAT_LEVELS };
