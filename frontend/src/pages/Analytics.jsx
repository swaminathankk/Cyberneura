import React from 'react';
import { BarChart2, Database } from 'lucide-react';
import ThreatChart from '../components/Analytics/ThreatChart.jsx';

const FEED_INFO = [
    { name: 'PhishTank', color: 'bg-red-400', desc: 'Verified phishing URLs from community reports' },
    { name: 'OpenPhish', color: 'bg-orange-400', desc: 'Open community phishing URL feed' },
    { name: 'URLhaus', color: 'bg-yellow-400', desc: 'Malware distribution URLs (abuse.ch)' },
    { name: 'Google Safe Browse', color: 'bg-cyber-400', desc: 'Real-time API lookup for MALWARE & SOCIAL_ENGINEERING' },
];

export default function AnalyticsPage() {
    return (
        <div className="space-y-6 max-w-7xl">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-cyber-400" /> Threat Analytics
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Historical threat detections and intelligence feed statistics
                </p>
            </div>

            {/* Weekly chart */}
            <div className="cyber-card p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">7-Day Threat Distribution</h3>
                <ThreatChart />
            </div>

            {/* Feed breakdown */}
            <div className="cyber-card p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyber-400" /> Threat Intelligence Sources
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FEED_INFO.map(({ name, color, desc }) => (
                        <div key={name} className="flex items-start gap-3 p-4 rounded-lg bg-dark-950/60 border border-white/5">
                            <div className={`w-2 h-2 rounded-full ${color} mt-1.5 flex-shrink-0`} />
                            <div>
                                <p className="text-sm font-medium text-slate-200">{name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Behavioral signals reference */}
            <div className="cyber-card p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Behavioral Heuristic Signals</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                    {[
                        ['HIGH_ENTROPY', '+20', 'URL path has high randomness'],
                        ['IP_ADDRESS_HOST', '+25', 'Hostname is an IP address'],
                        ['PUNYCODE_IDN_DETECTED', '+20', 'IDN homograph attack'],
                        ['EXCESSIVE_URL_LENGTH', '+15', 'URL over 200 chars'],
                        ['BRAND_IMPERSONATION', '+20', 'Known brand in path/subdomain'],
                        ['HIGH_RISK_TLD', '+15', '.tk .xyz .top etc.'],
                        ['EXCESSIVE_SUBDOMAINS', '+15', '4+ subdomain levels'],
                        ['AT_SYMBOL_IN_URL', '+25', '@ can mask real destination'],
                        ['MULTIPLE_SUSPICIOUS_KEYWORDS', '+15', 'login/verify/secure etc.'],
                        ['INSECURE_HTTP', '+5', 'Not using HTTPS'],
                        ['URL_OBFUSCATION', '+10', 'Double slash detected'],
                        ['EXCESSIVE_QUERY_PARAMS', '+8', '5+ query parameters'],
                    ].map(([flag, weight, desc]) => (
                        <div key={flag} className="p-2.5 rounded bg-dark-950/60 border border-white/5">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-orange-400">{flag}</span>
                                <span className="text-red-400 font-bold">{weight}</span>
                            </div>
                            <span className="text-slate-600">{desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
