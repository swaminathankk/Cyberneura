import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// Generate mock historical data for demo (7 days)
function generateMockData() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day) => ({
        day,
        safe: Math.floor(Math.random() * 200 + 150),
        low: Math.floor(Math.random() * 50 + 20),
        medium: Math.floor(Math.random() * 30 + 10),
        high: Math.floor(Math.random() * 20 + 5),
        critical: Math.floor(Math.random() * 10 + 1),
    }));
}

const COLORS = {
    safe: '#22c55e',
    low: '#eab308',
    medium: '#f97316',
    high: '#ef4444',
    critical: '#a855f7',
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="cyber-card px-4 py-3 text-xs space-y-1 min-w-[140px]">
            <p className="font-bold text-slate-300 mb-2">{label}</p>
            {payload.map((p) => (
                <div key={p.dataKey} className="flex items-center justify-between gap-4">
                    <span className="capitalize" style={{ color: p.color }}>{p.dataKey}</span>
                    <span className="font-mono font-bold text-slate-200">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

export default function ThreatChart({ data }) {
    const chartData = data || generateMockData();

    return (
        <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                    {Object.entries(COLORS).map(([key, color]) => (
                        <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '12px' }}
                />
                {Object.entries(COLORS).map(([key, color]) => (
                    <Area
                        key={key} type="monotone" dataKey={key}
                        stroke={color} strokeWidth={1.5}
                        fill={`url(#grad-${key})`}
                    />
                ))}
            </AreaChart>
        </ResponsiveContainer>
    );
}
