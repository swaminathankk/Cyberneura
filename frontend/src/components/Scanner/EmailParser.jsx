import React, { useState } from 'react';
import { Mail, Loader2, Link, Eye, AlertTriangle } from 'lucide-react';
import { scanApi } from '../../api/scan.api.js';
import useAppStore from '../../store/useAppStore.js';
import ThreatBadge from '../Results/ThreatBadge.jsx';

const SAMPLE_EMAIL = `From: security@paypa1-accounts.tk
Subject: Urgent: Verify your account immediately

Dear Customer,

Your account has been suspended. Please verify your identity:
Click here: http://paypal-secure-login.tk/verify?token=abc123
Also visit: https://legitimate-looking.xyz/authenticate

Your account will be permanently closed within 24 hours.

Security Team`;

export default function EmailParser() {
    const [content, setContent] = useState('');
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const { addAlert } = useAppStore();

    const handleScan = async () => {
        if (!content.trim()) return;
        setScanning(true);
        setError(null);
        setResults(null);

        try {
            const res = await scanApi.scanEmail(content);
            setResults(res.data);

            const criticalCount = res.data.results?.filter((r) =>
                ['HIGH', 'CRITICAL'].includes(r.level)
            ).length || 0;

            if (criticalCount > 0) {
                addAlert({
                    type: 'critical',
                    title: `${criticalCount} dangerous URL${criticalCount > 1 ? 's' : ''} found in email`,
                    message: `${res.data.urlsFound} URLs scanned, ${res.data.hiddenUrlsFound} hidden`,
                });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Textarea */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Paste email content or HTML block
                    </label>
                    <button
                        className="text-xs text-cyber-400 hover:text-cyber-300 font-mono"
                        onClick={() => setContent(SAMPLE_EMAIL)}
                    >
                        Load sample phishing email →
                    </button>
                </div>
                <textarea
                    id="email-input"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste email headers, body, or raw HTML here..."
                    rows={10}
                    className="cyber-input w-full p-4 resize-none leading-relaxed"
                    disabled={scanning}
                />
            </div>

            <div className="flex items-center gap-3">
                <button
                    id="parse-btn"
                    onClick={handleScan}
                    disabled={scanning || !content.trim()}
                    className="cyber-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {scanning ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                    ) : (
                        <><Mail className="w-4 h-4" /> Extract &amp; Scan URLs</>
                    )}
                </button>
                {content && (
                    <button
                        className="cyber-button-ghost"
                        onClick={() => { setContent(''); setResults(null); }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">{error}</div>
            )}

            {/* Results */}
            {results && (
                <div className="space-y-4">
                    {/* Summary row */}
                    <div className="cyber-card p-4 flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <Link className="w-4 h-4 text-cyber-400" />
                            <span className="text-slate-400">URLs Found:</span>
                            <span className="font-bold text-white">{results.urlsFound}</span>
                        </div>
                        {results.hiddenUrlsFound > 0 && (
                            <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4 text-orange-400" />
                                <span className="text-slate-400">Hidden:</span>
                                <span className="font-bold text-orange-400">{results.hiddenUrlsFound}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-slate-400">Threats:</span>
                            <span className="font-bold text-red-400">
                                {results.results?.filter((r) => ['HIGH', 'CRITICAL', 'MEDIUM'].includes(r.level)).length || 0}
                            </span>
                        </div>
                    </div>

                    {/* Results table */}
                    <div className="cyber-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-cyber-900/40">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">URL</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Score</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Level</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Hidden</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.results?.map((r, i) => (
                                    <tr key={i} className="border-b border-cyber-900/20 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-slate-300 max-w-xs truncate" title={r.url}>{r.url}</td>
                                        <td className="px-4 py-3">
                                            <span className={`font-bold tabular-nums ${r.score >= 85 ? 'text-purple-400' :
                                                    r.score >= 65 ? 'text-red-400' :
                                                        r.score >= 40 ? 'text-orange-400' :
                                                            r.score >= 20 ? 'text-yellow-400' : 'text-green-400'
                                                }`}>{r.score}</span>
                                        </td>
                                        <td className="px-4 py-3"><ThreatBadge level={r.level} /></td>
                                        <td className="px-4 py-3">
                                            {r.isHidden && <span className="badge-medium">Hidden</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
