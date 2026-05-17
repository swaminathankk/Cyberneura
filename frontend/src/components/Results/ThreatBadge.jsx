import React from 'react';

const LEVEL_CONFIG = {
    SAFE: { label: 'SAFE', className: 'badge-safe', dot: 'bg-green-400' },
    LOW: { label: 'LOW RISK', className: 'badge-low', dot: 'bg-yellow-400' },
    MEDIUM: { label: 'MEDIUM', className: 'badge-medium', dot: 'bg-orange-400' },
    HIGH: { label: 'HIGH RISK', className: 'badge-high', dot: 'bg-red-400' },
    CRITICAL: { label: 'CRITICAL', className: 'badge-critical', dot: 'bg-purple-400' },
};

export default function ThreatBadge({ level, size = 'md' }) {
    const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.SAFE;
    return (
        <span className={config.className}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${level === 'CRITICAL' ? 'animate-ping-slow' : ''}`} />
            {config.label}
        </span>
    );
}
