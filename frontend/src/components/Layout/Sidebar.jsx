import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Shield, Search, Mail, BarChart2, Activity,
    Zap, ChevronRight, Database,
} from 'lucide-react';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity, path: '/dashboard' },
    { id: 'scanner', label: 'URL Scanner', icon: Search, path: '/scanner' },
    { id: 'email', label: 'Email Parser', icon: Mail, path: '/email-parser' },
    { id: 'analytics', label: 'Analytics', icon: BarChart2, path: '/analytics' },
];

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <aside className="w-60 flex-shrink-0 flex flex-col bg-dark-900/80 border-r border-cyber-900/50 backdrop-blur-md relative z-20">
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-cyber-900/40">
                <div className="relative">
                    <div className="w-9 h-9 bg-cyber-500/20 rounded-lg flex items-center justify-center border border-cyber-500/30">
                        <Shield className="w-5 h-5 text-cyber-400" />
                    </div>
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-dark-900 animate-pulse-slow" />
                </div>
                <div>
                    <h1 className="text-sm font-bold text-gradient-cyber tracking-wide">CyberNeura</h1>
                    <p className="text-xs text-slate-500 font-mono">v1.0.0 · LIVE</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                <p className="px-3 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-widest">
                    Navigation
                </p>
                {NAV_ITEMS.map(({ id, label, icon: Icon, path }) => {
                    const isActive = location.pathname === path;
                    return (
                        <button
                            key={id}
                            id={`nav-${id}`}
                            onClick={() => navigate(path)}
                            className={`nav-item w-full text-left ${isActive ? 'active' : ''}`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{label}</span>
                            {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                        </button>
                    );
                })}
            </nav>

            {/* Feed status footer */}
            <div className="px-4 py-4 border-t border-cyber-900/40">
                <div className="flex items-center gap-2 mb-2">
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500 font-medium">Threat Feeds</span>
                </div>
                {['PhishTank', 'OpenPhish', 'URLhaus', 'GSB'].map((feed) => (
                    <div key={feed} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-slate-600">{feed}</span>
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
                            <span className="text-xs text-green-400 font-mono">ACTIVE</span>
                        </div>
                    </div>
                ))}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <Zap className="w-3 h-3 text-cyber-400" />
                    <span>Sync: every 30 min</span>
                </div>
            </div>
        </aside>
    );
}
