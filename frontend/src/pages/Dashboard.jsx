import React, { useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Activity, TrendingUp, Database, Zap } from 'lucide-react';
import useAppStore from '../store/useAppStore.js';
import { scanApi } from '../api/scan.api.js';
import ThreatChart from '../components/Analytics/ThreatChart.jsx';
import ThreatBadge from '../components/Results/ThreatBadge.jsx';

function StatCard({ icon: Icon, label, value, sub, color = 'text-cyber-400' }) {
    return (
        <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <span className="text-3xl font-bold text-white tabular-nums">{value}</span>
            {sub && <span className="text-xs text-slate-500 mt-1">{sub}</span>}
        </div>
    );
}

export default function DashboardPage() {
    const { health, history, setHistory } = useAppStore();

    useEffect(() => {
        scanApi.getHistory(1, 10).then((res) => {
            if (res?.data) setHistory(res.data.results, res.data.total, 1);
        }).catch(() => { });
    }, [setHistory]);

    const blacklistCount = parseInt(health?.checks?.redis?.blacklistCount || 0);
    const redisOk = health?.checks?.redis?.status === 'ok';
    const pgOk = health?.checks?.postgres?.status === 'ok';

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Page title */}
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyber-400" /> Threat Intelligence Dashboard
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Real-time overview of system status and recent threat detections
                </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={Database} label="Blacklisted URLs" color="text-red-400"
                    value={blacklistCount.toLocaleString()}
                    sub="Cached in Redis"
                />
                <StatCard
                    icon={Shield} label="System Status" color={redisOk && pgOk ? 'text-green-400' : 'text-red-400'}
                    value={redisOk && pgOk ? 'Healthy' : 'Degraded'}
                    sub={`Redis: ${redisOk ? 'OK' : 'ERR'} · PG: ${pgOk ? 'OK' : 'ERR'}`}
                />
                <StatCard
                    icon={Activity} label="Scans Today"
                    value={history.length || '—'}
                    sub="From scan history"
                    color="text-cyber-400"
                />
                <StatCard
                    icon={Zap} label="Feed Sync"
                    value="30m"
                    sub="Cron interval"
                    color="text-yellow-400"
                />
            </div>

            {/* Charts + recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Threat Chart — spans 2 cols */}
                <div className="lg:col-span-2 cyber-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-cyber-400" /> Weekly Threat Detections
                        </h3>
                        <span className="text-xs text-slate-500 font-mono">Last 7 days</span>
                    </div>
                    <ThreatChart />
                </div>

                {/* Feed status */}
                <div className="cyber-card p-5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                        <Database className="w-4 h-4 text-cyber-400" /> Feed Status
                    </h3>
                    <div className="space-y-3">
                        {[
                            { name: 'PhishTank', key: 'phishtank' },
                            { name: 'OpenPhish', key: 'openphish' },
                            { name: 'URLhaus', key: 'urlhaus' },
                            { name: 'Google GSB', key: 'gsb' },
                        ].map(({ name, key }) => {
                            const count = health?.checks?.redis?.feedStats?.[`${key}:count`];
                            const ts = health?.checks?.redis?.feedStats?.[`${key}:lastSync`];
                            const lastSync = ts ? new Date(parseInt(ts)).toLocaleTimeString() : 'Pending';
                            return (
                                <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-dark-950/60 border border-white/5">
                                    <div>
                                        <p className="text-xs font-medium text-slate-300">{name}</p>
                                        <p className="text-xs text-slate-600 font-mono mt-0.5">{lastSync}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
                                            <span className="text-xs text-green-400 font-mono">LIVE</span>
                                        </div>
                                        {count && <p className="text-xs text-slate-600 font-mono">{parseInt(count).toLocaleString()} URLs</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Recent scans */}
            {history.length > 0 && (
                <div className="cyber-card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-cyber-900/30">
                        <h3 className="text-sm font-semibold text-slate-300">Recent Scans</h3>
                        <span className="text-xs text-slate-600 font-mono">{history.length} shown</span>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-cyber-900/20">
                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">URL</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Score</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Level</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((row, i) => (
                                <tr key={row.scan_id || i} className="border-b border-cyber-900/10 hover:bg-white/[0.02]">
                                    <td className="px-5 py-3 font-mono text-xs text-slate-400 max-w-xs truncate">{row.url}</td>
                                    <td className="px-5 py-3 font-mono font-bold text-slate-200">{row.score}</td>
                                    <td className="px-5 py-3"><ThreatBadge level={row.level} /></td>
                                    <td className="px-5 py-3 text-xs text-slate-600 font-mono">
                                        {new Date(row.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
