import React from 'react';
import { Search } from 'lucide-react';
import UrlScanner from '../components/Scanner/UrlScanner.jsx';

export default function ScannerPage() {
    return (
        <div className="max-w-3xl space-y-5">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-cyber-400" /> URL Scanner
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Scan any URL through the full 7-stage threat analysis pipeline
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                    {['Whitelist Check', 'Redis Blacklist', 'Google Safe Browsing', 'Behavioral Analysis', 'AI Model', 'Risk Score'].map((step, i) => (
                        <span key={step} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-800 border border-cyber-900/40 text-xs text-slate-400">
                            <span className="w-4 h-4 rounded-full bg-cyber-500/20 text-cyber-400 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                            {step}
                        </span>
                    ))}
                </div>
            </div>
            <UrlScanner />
        </div>
    );
}
