import { create } from 'zustand';

const useAppStore = create((set, get) => ({
    // ── Scan state ────────────────────────────────────────────────
    scanResult: null,
    bulkResults: [],
    emailResults: null,
    isScanning: false,
    scanError: null,

    setScanResult: (result) => set({ scanResult: result, scanError: null }),
    setBulkResults: (results) => set({ bulkResults: results }),
    setEmailResults: (results) => set({ emailResults: results }),
    setIsScanning: (val) => set({ isScanning: val }),
    setScanError: (err) => set({ scanError: err, isScanning: false }),
    clearScanResult: () => set({ scanResult: null, bulkResults: [], emailResults: null, scanError: null }),

    // ── Scan history ──────────────────────────────────────────────
    history: [],
    historyTotal: 0,
    historyPage: 1,
    setHistory: (rows, total, page) => set({ history: rows, historyTotal: total, historyPage: page }),

    // ── Alerts queue ──────────────────────────────────────────────
    alerts: [],
    addAlert: (alert) => {
        const id = Date.now() + Math.random();
        set((s) => ({ alerts: [{ id, ...alert }, ...s.alerts].slice(0, 10) }));
        // Auto-dismiss after 6s
        setTimeout(() => get().dismissAlert(id), 6000);
    },
    dismissAlert: (id) =>
        set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

    // ── System health ─────────────────────────────────────────────
    health: null,
    setHealth: (h) => set({ health: h }),

    // ── Active page ───────────────────────────────────────────────
    activePage: 'dashboard',
    setActivePage: (page) => set({ activePage: page }),
}));

export default useAppStore;
