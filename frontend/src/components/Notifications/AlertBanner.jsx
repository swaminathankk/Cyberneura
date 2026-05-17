import React from 'react';
import { X, AlertTriangle, CheckCircle, AlertOctagon, Info } from 'lucide-react';
import useAppStore from '../../store/useAppStore.js';

const ICONS = {
    critical: AlertOctagon,
    high: AlertTriangle,
    medium: AlertTriangle,
    info: Info,
    success: CheckCircle,
};

const STYLES = {
    critical: 'bg-purple-900/80 border-purple-500/40 text-purple-200',
    high: 'bg-red-900/80 border-red-500/40 text-red-200',
    medium: 'bg-orange-900/80 border-orange-500/40 text-orange-200',
    info: 'bg-cyber-900/80 border-cyber-500/40 text-cyber-200',
    success: 'bg-green-900/80 border-green-500/40 text-green-200',
};

export default function AlertBanner() {
    const { alerts, dismissAlert } = useAppStore();

    if (alerts.length === 0) return null;

    return (
        <div className="absolute top-14 left-60 right-0 z-50 px-6 py-2 flex flex-col gap-1.5 pointer-events-none">
            {alerts.slice(0, 5).map((alert) => {
                const type = alert.type || 'info';
                const Icon = ICONS[type] || Info;
                return (
                    <div
                        key={alert.id}
                        className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm backdrop-blur-md
              pointer-events-auto shadow-lg animate-[fadeIn_0.2s_ease] ${STYLES[type] || STYLES.info}`}
                    >
                        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold">{alert.title}</p>
                            {alert.message && (
                                <p className="text-xs opacity-80 font-mono truncate mt-0.5">{alert.message}</p>
                            )}
                        </div>
                        <button
                            onClick={() => dismissAlert(alert.id)}
                            className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
