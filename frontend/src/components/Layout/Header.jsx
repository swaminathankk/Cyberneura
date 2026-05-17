import React, { useEffect, useState } from 'react';
import { Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import useAppStore from '../../store/useAppStore.js';
import { scanApi } from '../../api/scan.api.js';

export default function Header() {
    const { alerts, health, setHealth } = useAppStore();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const data = await scanApi.getHealth();
                setHealth(data);
            } catch {
                setHealth(null);
            }
        };
        fetchHealth();
        const h = setInterval(fetchHealth, 30_000);
        return () => clearInterval(h);
    }, [setHealth]);

    const isOnline = health?.success;
    const unreadCount = alerts.length;

    return (
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-dark-900/60 border-b border-cyber-900/40 backdrop-blur-md z-10">
            {/* Left: Status */}
            <div className="flex items-center gap-4">
                <div className={`flex items-center gap-1.5 text-xs font-mono font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                    {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    {isOnline ? 'ALL SYSTEMS OPERATIONAL' : 'BACKEND OFFLINE'}
                </div>
                {health?.checks?.redis && (
                    <div className="text-xs text-slate-500 font-mono hidden md:block">
                        {parseInt(health.checks.redis.blacklistCount || 0).toLocaleString()} URLs cached
                    </div>
                )}
            </div>

            {/* Right: Clock + alerts */}
            <div className="flex items-center gap-4">
                <div className="text-xs font-mono text-slate-500 hidden sm:block">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    <span className="ml-2 text-slate-600">
                        {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                </div>

                {/* Alert bell */}
                <button id="alert-bell" className="relative p-2 rounded-lg hover:bg-cyber-500/10 text-slate-400 hover:text-slate-200 transition-colors">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center leading-none font-bold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* Refresh */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
                    <span className="hidden sm:block">Live</span>
                </div>
            </div>
        </header>
    );
}
