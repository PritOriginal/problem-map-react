import { useCallback, useSyncExternalStore } from "react";

/**
 * The colour theme. Three states, not two: "auto" follows the operating system,
 * which is the right default for a field app whose users move between daylight
 * and night. An explicit choice overrides it and is remembered.
 *
 * Deliberately a plain external store, not MobX -- it mirrors LangStore in
 * src/i18n/index.ts so both work the same way and can be read outside React
 * (the map style is chosen from JS, and `var()` means nothing to WebGL).
 */
export type Theme = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEMES: readonly Theme[] = ["auto", "light", "dark"];
export const DEFAULT_THEME: Theme = "auto";
export const THEME_STORAGE_KEY = "theme";

/** The browser-tab colour, matching --chrome in each theme. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: "#1b1d1c", dark: "#0f1112" };

export function parseTheme(value: unknown): Theme | null {
    return typeof value === "string" && (THEMES as readonly string[]).includes(value) ? (value as Theme) : null;
}

function readStoredTheme(): Theme {
    try {
        return parseTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

function systemPrefersDark(): boolean {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** What "auto" actually resolves to right now. */
export function resolveTheme(theme: Theme): ResolvedTheme {
    if (theme === "auto") {
        return systemPrefersDark() ? "dark" : "light";
    }
    return theme;
}

type Listener = () => void;

class ThemeStore {
    private theme: Theme = readStoredTheme();
    private listeners = new Set<Listener>();

    constructor() {
        this.applyToDocument();
        // While on "auto", follow the system as it changes -- no reload needed.
        if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
                if (this.theme === "auto") {
                    this.applyToDocument();
                    this.listeners.forEach((listener) => listener());
                }
            });
        }
    }

    get = (): Theme => this.theme;

    getResolved = (): ResolvedTheme => resolveTheme(this.theme);

    set = (theme: Theme) => {
        if (theme === this.theme) {
            return;
        }
        this.theme = theme;
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // storage may be unavailable (private mode); the choice lives for the session only
        }
        this.applyToDocument();
        this.listeners.forEach((listener) => listener());
    };

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /**
     * "auto" leaves the attribute off entirely, so the stylesheet's
     * prefers-color-scheme block is what decides. An explicit choice stamps
     * data-theme, which the stylesheet lets win in both directions.
     */
    private applyToDocument() {
        if (typeof document === "undefined") {
            return;
        }
        const root = document.documentElement;
        if (this.theme === "auto") {
            root.removeAttribute("data-theme");
        } else {
            root.setAttribute("data-theme", this.theme);
        }
        const resolved = this.getResolved();
        root.style.colorScheme = resolved;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
    }
}

const themeStore = new ThemeStore();

export const getTheme = (): Theme => themeStore.get();
export const setTheme = (theme: Theme) => themeStore.set(theme);

/** Current theme choice plus what it resolves to, re-rendering on change. */
export function useTheme(): { theme: Theme; resolved: ResolvedTheme } {
    const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, () => DEFAULT_THEME);
    const resolved = useSyncExternalStore(themeStore.subscribe, themeStore.getResolved, () => "light" as ResolvedTheme);
    return { theme, resolved };
}

/** Stable setter for the switcher. */
export function useSetTheme(): (theme: Theme) => void {
    return useCallback((theme: Theme) => themeStore.set(theme), []);
}
