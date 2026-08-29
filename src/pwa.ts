/**
 * Registers `public/sw.js` (app-shell cache + network-first for GET `/api/*` dictionaries).
 * Only in production builds: in dev the worker would serve stale Vite modules.
 */
export function registerServiceWorker(): void {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
        return;
    }
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
            console.error("Service worker registration failed:", error);
        });
    });
}
