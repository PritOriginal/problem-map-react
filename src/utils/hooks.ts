import { useEffect, useState, useSyncExternalStore } from "react";

export const useDeviceDetect = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setIsMobile(windowWidth <= 768)
    }, [windowWidth])

    return { isMobile, windowWidth };
};

const NOW_INTERVAL_MS = 30_000;

/** One shared ticker for every `useNow` subscriber (many badges → one interval). */
const nowTicker = (() => {
    const listeners = new Set<() => void>();
    let now = Date.now();
    let timer: number | undefined;
    return {
        get: () => now,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            if (timer === undefined) {
                timer = window.setInterval(() => {
                    now = Date.now();
                    listeners.forEach((l) => l());
                }, NOW_INTERVAL_MS);
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0 && timer !== undefined) {
                    window.clearInterval(timer);
                    timer = undefined;
                }
            };
        },
    };
})();

/** Current time, refreshed every 30 s by a single shared interval (for countdowns). */
export const useNow = (): number => useSyncExternalStore(nowTicker.subscribe, nowTicker.get, nowTicker.get);

/** `navigator.onLine`, kept in sync with the `online` / `offline` events. */
export const useOnline = (): boolean => {
    const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener("online", up);
        window.addEventListener("offline", down);
        return () => {
            window.removeEventListener("online", up);
            window.removeEventListener("offline", down);
        };
    }, []);
    return online;
};
