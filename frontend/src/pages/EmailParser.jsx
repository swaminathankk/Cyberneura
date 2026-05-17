import React from 'react';
import { Mail } from 'lucide-react';
import EmailParser from '../components/Scanner/EmailParser.jsx';

export default function EmailParserPage() {
    return (
        <div className="max-w-4xl space-y-5">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Mail className="w-5 h-5 text-cyber-400" /> Email / HTML Parser
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Paste a raw email, HTML page, or text block to extract and scan all embedded URLs — including hidden ones.
                </p>
            </div>
            <EmailParser />
        </div>
    );
}
