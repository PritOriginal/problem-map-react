import { useCallback, useSyncExternalStore } from "react";
import { ru, TranslationKey } from "./ru";

export type { TranslationKey } from "./ru";

export type Lang = "ru" | "en";
export const LANGS: readonly Lang[] = ["ru", "en"];
export const DEFAULT_LANG: Lang = "ru";
export const LANG_STORAGE_KEY = "lang";

type Dict = Partial<Record<TranslationKey, string>>;

/**
 * Russian is the default, the fallback and the reference dictionary, so it is linked
 * statically. English is not: it is ~20 KB of the entry chunk that the Russian-reading
 * majority downloads and never reads, so it is fetched on demand instead.
 *
 * Loaded once, then kept — `ensureDict` is cheap to call repeatedly, and the same
 * in-flight promise is shared so a double switch does not fetch the chunk twice.
 */
let enDict: Dict | null = null;
let enLoading: Promise<void> | null = null;

/** Makes sure `t()` can answer in `lang`. Resolves immediately for anything already loaded. */
export function ensureDict(lang: Lang): Promise<void> {
    if (lang !== "en" || enDict) {
        return Promise.resolve();
    }
    enLoading ??= import("./en").then(
        (module) => {
            enDict = module.en;
            enLoading = null;
        },
        (error) => {
            // the chunk is unreachable (offline, a stale deploy): stay on the Russian
            // fallback rather than blocking the switch, and let the next call retry
            enLoading = null;
            console.error("i18n: failed to load the English dictionary", error);
        },
    );
    return enLoading;
}

/** True when `lang` can be rendered right now, without waiting for a chunk. */
function dictLoaded(lang: Lang): boolean {
    return lang !== "en" || enDict !== null;
}

/** The dictionary to read `lang` from; Russian while English is still on its way. */
function dictOf(lang: Lang): Dict {
    return lang === "en" ? enDict ?? ru : ru;
}

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

    /**
     * Switches the language.
     *
     * The choice itself takes effect at once — `getLang()` answers the new language
     * immediately, so the very next request already carries the right
     * `Accept-Language`. What waits is the *notification*: subscribers are told only
     * once the dictionary for that language is in memory, or the whole interface would
     * re-render against the Russian fallback and then flip to English a tick later.
     *
     * Nothing re-reads `t()` without being notified, so the window between the two is
     * invisible. The common case (Russian, or English already loaded) is fully
     * synchronous, exactly as it was when both dictionaries were linked statically.
     */
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

        if (dictLoaded(lang)) {
            this.notify();
            return;
        }
        void ensureDict(lang).then(() => {
            // a second switch may have overtaken this one; that switch did its own notify
            if (this.lang === lang) {
                this.notify();
            }
        });
    };

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private notify() {
        this.listeners.forEach((listener) => listener());
    }

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
    const template = dictOf(lang)[key] ?? ru[key];
    if (template === undefined) {
        warnMissingOnce(key);
        return interpolate(key, params);
    }
    return interpolate(template, params);
}

const reportedMissing = new Set<string>();

/** Logs an unknown key once per session so a typo shows up in the console without flooding it. */
function warnMissingOnce(key: string): void {
    if (reportedMissing.has(key)) {
        return;
    }
    reportedMissing.add(key);
    console.warn(`i18n: missing translation key "${key}"`);
}

/** Translates a dynamic key (e.g. built from a status id); unknown keys yield `fallback`. */
export function tOr(key: string, fallback: string, params?: TParams, lang: Lang = langStore.get()): string {
    const template = dictOf(lang)[key as TranslationKey] ?? ru[key as TranslationKey];
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
