import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { LANG_STORAGE_KEY, getLang, setLang, t, tOr, useT } from "./index";
import { ru } from "./ru";
import { en } from "./en";

describe("t / dictionaries", () => {
    beforeEach(() => setLang("ru"));

    it("translates the current language and interpolates params", () => {
        expect(t("nav.tasks")).toBe("Задания");
        expect(t("common.problemN", { id: 7 })).toBe("Проблема №7");
        setLang("en");
        expect(t("nav.tasks")).toBe("Tasks");
        expect(t("common.problemN", { id: 7 })).toBe("Problem #7");
    });

    it("falls back to Russian for a key missing in English and to the key when unknown", () => {
        const missing = (Object.keys(ru) as (keyof typeof ru)[]).find((key) => !(key in en));
        // the English dictionary is complete: emulate a gap explicitly
        const key = missing ?? ("nav.tasks" as keyof typeof ru);
        const saved = en[key];
        delete en[key];
        try {
            expect(t(key, undefined, "en")).toBe(ru[key]);
        } finally {
            if (saved !== undefined) {
                en[key] = saved;
            }
        }
        expect(tOr("no.such.key", "fallback")).toBe("fallback");
        expect(tOr("tasks.status.3", "?")).toBe("Просрочено");
    });

    it("keeps unknown placeholders and accepts an explicit language", () => {
        expect(t("tasks.dueLeft", { other: 1 }, "en")).toBe("{time} left");
        expect(t("mark.slaOverdue", { time: "2 h" }, "en")).toBe("SLA: overdue by 2 h");
    });

    it("persists the language in localStorage and updates <html lang>", () => {
        setLang("en");
        expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
        expect(document.documentElement.lang).toBe("en");
        expect(getLang()).toBe("en");
    });
});

describe("useT", () => {
    let root: Root;
    let container: HTMLDivElement;

    beforeEach(() => {
        setLang("ru");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    function Label() {
        const { t, lang } = useT();
        return <span data-lang={lang}>{t("nav.leaderboard")}</span>;
    }

    it("re-renders a plain (non-observer) component when the language changes", () => {
        act(() => root.render(<Label />));
        const span = () => container.querySelector("span")!;
        expect(span().textContent).toBe("Рейтинг");
        expect(span().dataset.lang).toBe("ru");
        act(() => setLang("en"));
        expect(span().textContent).toBe("Leaderboard");
        expect(span().dataset.lang).toBe("en");
    });
});
