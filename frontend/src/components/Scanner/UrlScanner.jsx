import React, { useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { scanApi } from '../../api/scan.api.js';
import useAppStore from '../../store/useAppStore.js';
import ThreatResult from '../Results/ThreatResult.jsx';

export default function UrlScanner() {
    const [url, setUrl] = useState('');
    const { isScanning, setIsScanning, scanResult, setScanResult, scanError, setScanError, addAlert } = useAppStore();

    const handleScan = async (e) => {
        e.preventDefault();
        const trimmed = url.trim();
        if (!trimmed) return;

        setIsScanning(true);
        setScanError(null);

        try {
            const res = await scanApi.scanUrl(trimmed);
            setScanResult(res.data);

            // Fire alert for HIGH / CRITICAL
            if (['HIGH', 'CRITICAL'].includes(res.data.level)) {
                addAlert({
                    type: res.data.level.toLowerCase(),
                    title: `${res.data.level} Threat Detected`,
                    message: trimmed,
                });
            }
        } catch (err) {
            setScanError(err.message);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Input form */}
            <form onSubmit={handleScan} className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                        id="url-input"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/suspicious-path?token=..."
                        className="cyber-input w-full pl-9 pr-4 py-3"
                        disabled={isScanning}
                    />
                    {url && (
                        <button
                            type="button"
                            onClick={() => setUrl('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <button
                    id="scan-btn"
                    type="submit"
                    disabled={isScanning || !url.trim()}
                    className="cyber-button-primary disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] justify-center"
                >
                    {isScanning ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Scanning</>
                    ) : (
                        <><Search className="w-4 h-4" /> Scan</>
                    )}
                </button>
            </form>

            {/* Error */}
            {scanError && (
                <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
                    {scanError}
                </div>
            )}

            {/* Scanning animation */}
            {isScanning && (
                <div className="cyber-card p-8 flex flex-col items-center gap-4 scan-effect">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-2 border-cyber-500/20" />
                        <div className="absolute inset-0 rounded-full border-t-2 border-cyber-400 animate-spin" />
                        <Search className="absolute inset-0 m-auto w-6 h-6 text-cyber-400" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-slate-300">Running threat analysis pipeline</p>
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                            Checking blacklists → GSB → Behavioral → AI Model
                        </p>
                    </div>
                </div>
            )}

            {/* Results */}
            {!isScanning && <ThreatResult result={scanResult} />}
        </div>
    );
}
