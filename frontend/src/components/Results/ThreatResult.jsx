import React from 'react';
import ThreatBadge from './ThreatBadge.jsx';
import { ShieldCheck, ShieldAlert, Clock, Cpu, Network, Link } from 'lucide-react';

// SVG arc gauge — animates score from 0 to value
function RiskGauge({ score }) {
    const radius = 80;
    const stroke = 10;
    const normalizedRadius = radius - stroke / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const arc = circumference * 0.75; // 270° arc
    const dashOffset = arc - (score / 100) * arc;

    const getColor = (s) => {
        if (s >= 85) return '#a855f7';
        if (s >= 65) return '#ef4444';
        if (s >= 40) return '#f97316';
        if (s >= 20) return '#eab308';
        return '#22c55e';
    };

    const color = getColor(score);

    return (
        <div className="relative flex items-center justify-center" style={{ width: 180, height: 160 }}>
            <svg width={180} height={180} className="absolute top-0 left-0 -rotate-[135deg]">
                {/* Track */}
                <circle
                    cx={90} cy={90} r={normalizedRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={stroke}
                    strokeDasharray={`${arc} ${circumference}`}
                    strokeLinecap="round"
                />
                {/* Progress */}
                <circle
                    cx={90} cy={90} r={normalizedRadius}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={`${arc} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{
                        filter: `drop-shadow(0 0 8px ${color})`,
                        transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                />
            </svg>
            {/* Center label */}
            <div className="relative flex flex-col items-center justify-center pt-4">
                <span className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</span>
                <span className="text-xs text-slate-500 font-mono uppercase tracking-widest">Risk Score</span>
            </div>
        </div>
    );
}

export default function ThreatResult({ result }) {
    if (!result) return null;

    const {
        url, score, level, recommendation, signalBreakdown,
        behavioral, duration, scanId,
    } = result;

    return (
        <div className="cyber-card p-6 space-y-6 animate-[fadeIn_0.3s_ease]">
            {/* Top: URL + badge */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                        <Link className="w-3 h-3" /> Scanned URL
                    </p>
                    <p className="font-mono text-sm text-slate-300 break-all">{url}</p>
                </div>
                <ThreatBadge level={level} />
            </div>

            {/* Gauge + Recommendation */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <RiskGauge score={score} />
                <div className="flex-1 space-y-3">
                    <div className={`px-4 py-3 rounded-lg text-sm font-medium border ${level === 'CRITICAL' ? 'bg-purple-900/30 border-purple-500/30 text-purple-200' :
                            level === 'HIGH' ? 'bg-red-900/30 border-red-500/30 text-red-200' :
                                level === 'MEDIUM' ? 'bg-orange-900/30 border-orange-500/30 text-orange-200' :
                                    level === 'LOW' ? 'bg-yellow-900/30 border-yellow-500/30 text-yellow-200' :
                                        'bg-green-900/30 border-green-500/30 text-green-200'
                        }`}>
                        {recommendation}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{duration}ms</span>
                        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />Pipeline: complete</span>
                    </div>
                </div>
            </div>

            {/* Signal Breakdown */}
            {signalBreakdown && signalBreakdown.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Network className="w-3.5 h-3.5 text-cyber-400" /> Signal Breakdown
                    </h3>
                    <div className="space-y-2">
                        {signalBreakdown.map((sig, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                                <span className="w-36 text-slate-400 text-xs font-medium flex-shrink-0">{sig.source}</span>
                                <div className="flex-1 bg-dark-950 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${sig.score}%`,
                                            backgroundColor: sig.score >= 80 ? '#a855f7' : sig.score >= 60 ? '#ef4444' : sig.score >= 30 ? '#f97316' : sig.score > 0 ? '#eab308' : '#22c55e',
                                        }}
                                    />
                                </div>
                                <span className="w-8 text-right text-xs font-mono text-slate-400">{sig.score}</span>
                                {sig.note && (
                                    <span className="text-xs text-slate-600 max-w-xs truncate hidden lg:block">{sig.note}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Behavioral flags */}
            {behavioral?.flags?.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> Behavioral Flags
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                        {behavioral.flags.map((flag) => (
                            <span
                                key={flag}
                                className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono rounded"
                            >
                                {flag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Scan ID */}
            <p className="text-xs text-slate-700 font-mono">ID: {scanId}</p>
        </div>
    );
}
