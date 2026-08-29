import { useEffect, useState } from "react";

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

/** Current time, re-read every `intervalMs` (for countdowns). */
export const useNow = (intervalMs: number = 30_000): number => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(timer);
    }, [intervalMs]);
    return now;
};

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
