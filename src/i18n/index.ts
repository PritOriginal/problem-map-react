import { useCallback, useSyncExternalStore } from "react";
import { ru, TranslationKey } from "./ru";
import { en } from "./en";

export type { TranslationKey } from "./ru";

export type Lang = "ru" | "en";
export const LANGS: readonly Lang[] = ["ru", "en"];
export const DEFAULT_LANG: Lang = "ru";
export const LANG_STORAGE_KEY = "lang";

const DICTS: Record<Lang, Partial<Record<TranslationKey, string>>> = { ru, en };

export function parseLang(value: unknown): Lang | null {
    return typeof value === "string" && (LANGS as readonly string[]).includes(value) ? (value as Lang) : null;
}

function readStoredLang(): Lang {
    try {
        return parseLang(localStorage.getItem(LANG_STORAGE_KEY)) ?? DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
}

type Listener = () => void;

/**
 * Current UI language. A plain external store (no MobX) so it can be used both from
 * services (`getLang()`) and from any React component via `useSyncExternalStore`.
 * Persisted in localStorage under `lang`.
 */
class LangStore {
    private lang: Lang = readStoredLang();
    private listeners = new Set<Listener>();

    constructor() {
        this.applyToDocument();
    }

    get = (): Lang => this.lang;

    set = (lang: Lang) => {
        if (lang === this.lang) {
            return;
        }
        this.lang = lang;
        try {
            localStorage.setItem(LANG_STORAGE_KEY, lang);
        } catch {
            // storage may be unavailable (private mode); the choice then lives for the session only
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

    private applyToDocument() {
        if (typeof document !== "undefined") {
            document.documentElement.lang = this.lang;
        }
    }
}

export const langStore = new LangStore();

export const getLang = langStore.get;
export const setLang = langStore.set;

export type TParams = Record<string, string | number>;

function interpolate(template: string, params?: TParams): string {
    if (!params) {
        return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * Translates a key for the given language (defaults to the current one).
 * Falls back to Russian when the key is missing in the requested dictionary,
 * and to the key itself when it is unknown everywhere.
 */
export function t(key: TranslationKey, params?: TParams, lang: Lang = langStore.get()): string {
    const template = DICTS[lang][key] ?? ru[key] ?? key;
    return interpolate(template, params);
}

/** Translates a dynamic key (e.g. built from a status id); unknown keys yield `fallback`. */
export function tOr(key: string, fallback: string, params?: TParams, lang: Lang = langStore.get()): string {
    const template = DICTS[lang][key as TranslationKey] ?? ru[key as TranslationKey];
    return template === undefined ? fallback : interpolate(template, params);
}

/** React hook: `[t, lang]`; the component re-renders when the language changes. */
export function useT(): { t: (key: TranslationKey, params?: TParams) => string; lang: Lang } {
    const lang = useSyncExternalStore(langStore.subscribe, langStore.get, langStore.get);
    const translate = useCallback((key: TranslationKey, params?: TParams) => t(key, params, lang), [lang]);
    return { t: translate, lang };
}

/** Locale tag for `Intl` / `toLocale*` formatting. */
export function localeOf(lang: Lang): string {
    return lang === "en" ? "en-GB" : "ru-RU";
}
