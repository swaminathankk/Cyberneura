/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui'],
                mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
            },
            colors: {
                // Cyber dark palette
                cyber: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#38bdf8',
                    400: '#0ea5e9',
                    500: '#0284c7',
                    600: '#0369a1',
                    700: '#075985',
                    800: '#0c4a6e',
                    900: '#082f49',
                    950: '#041522',
                },
                // Dark background shades
                dark: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    700: '#1e293b',
                    800: '#0f172a',
                    900: '#020617',
                    950: '#010314',
                },
                // Threat level colors
                threat: {
                    safe: '#22c55e',
                    low: '#eab308',
                    medium: '#f97316',
                    high: '#ef4444',
                    critical: '#a855f7',
                },
            },
            backgroundImage: {
                'cyber-grid': `
          linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px)
        `,
                'hero-gradient': 'linear-gradient(135deg, #020617 0%, #041522 50%, #020617 100%)',
            },
            backgroundSize: {
                'grid-40': '40px 40px',
            },
            boxShadow: {
                'cyber': '0 0 15px rgba(14, 165, 233, 0.15)',
                'cyber-lg': '0 0 30px rgba(14, 165, 233, 0.2)',
                'threat-critical': '0 0 20px rgba(168, 85, 247, 0.3)',
                'threat-high': '0 0 20px rgba(239, 68, 68, 0.3)',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                'scan-line': 'scanLine 2s linear infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                scanLine: {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100vh)' },
                },
                glow: {
                    from: { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2)' },
                    to: { boxShadow: '0 0 20px rgba(14, 165, 233, 0.5)' },
                },
            },
        },
    },
    plugins: [],
};
