import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar.jsx';
import Header from './components/Layout/Header.jsx';
import AlertBanner from './components/Notifications/AlertBanner.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import ScannerPage from './pages/Scanner.jsx';
import EmailParserPage from './pages/EmailParser.jsx';
import AnalyticsPage from './pages/Analytics.jsx';

export default function App() {
    return (
        <BrowserRouter>
            <div className="flex h-screen bg-dark-950 overflow-hidden">
                {/* Cyber grid background */}
                <div className="fixed inset-0 bg-grid opacity-100 pointer-events-none z-0" />

                {/* Sidebar */}
                <Sidebar />

                {/* Main content area */}
                <div className="flex flex-col flex-1 overflow-hidden relative z-10">
                    <Header />

                    {/* Alert banners — stacks at top */}
                    <AlertBanner />

                    {/* Page content */}
                    <main className="flex-1 overflow-y-auto p-6">
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/scanner" element={<ScannerPage />} />
                            <Route path="/email-parser" element={<EmailParserPage />} />
                            <Route path="/analytics" element={<AnalyticsPage />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </main>
                </div>
            </div>
        </BrowserRouter>
    );
}
