import { Lang, t } from "../i18n";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Formats a non-negative duration compactly: `3 дн 4 ч`, `4 ч 15 мин`, `15 мин`, `< 1 мин`.
 * Two largest units at most, so a countdown stays readable.
 */
export function formatDuration(ms: number, lang?: Lang): string {
    const abs = Math.max(0, ms);
    const days = Math.floor(abs / DAY_MS);
    const hours = Math.floor((abs % DAY_MS) / HOUR_MS);
    const minutes = Math.floor((abs % HOUR_MS) / MINUTE_MS);
    const d = t("common.days", undefined, lang);
    const h = t("common.hours", undefined, lang);
    const m = t("common.minutes", undefined, lang);
    if (days > 0) {
        return hours > 0 ? `${days} ${d} ${hours} ${h}` : `${days} ${d}`;
    }
    if (hours > 0) {
        return minutes > 0 ? `${hours} ${h} ${minutes} ${m}` : `${hours} ${h}`;
    }
    if (minutes > 0) {
        return `${minutes} ${m}`;
    }
    return `< 1 ${m}`;
}

export interface DeadlineState {
    /** Milliseconds until the deadline; negative when it has passed. */
    remainingMs: number;
    overdue: boolean;
    /** Less than `soonMs` left (and not overdue yet). */
    soon: boolean;
}

/** Parses an ISO deadline; null for missing / malformed values. */
export function deadlineState(dueAt: string | null | undefined, nowMs: number = Date.now(), soonMs: number = DAY_MS): DeadlineState | null {
    if (!dueAt) {
        return null;
    }
    const due = Date.parse(dueAt);
    if (Number.isNaN(due)) {
        return null;
    }
    const remainingMs = due - nowMs;
    return { remainingMs, overdue: remainingMs < 0, soon: remainingMs >= 0 && remainingMs < soonMs };
}

/** `Осталось 2 дн 3 ч` / `Просрочено на 4 ч`; empty when there is no deadline. */
export function formatDeadline(dueAt: string | null | undefined, nowMs: number = Date.now(), lang?: Lang): string {
    const state = deadlineState(dueAt, nowMs);
    if (!state) {
        return "";
    }
    const time = formatDuration(Math.abs(state.remainingMs), lang);
    return state.overdue ? t("tasks.dueOverdue", { time }, lang) : t("tasks.dueLeft", { time }, lang);
}

/** `SLA: осталось …` / `SLA: просрочено на …`; empty when the mark has no SLA. */
export function formatSla(slaDueAt: string | null | undefined, nowMs: number = Date.now(), lang?: Lang): string {
    const state = deadlineState(slaDueAt, nowMs);
    if (!state) {
        return "";
    }
    const time = formatDuration(Math.abs(state.remainingMs), lang);
    return state.overdue ? t("mark.slaOverdue", { time }, lang) : t("mark.slaLeft", { time }, lang);
}

/** Local date-time for display. */
export function formatDateTime(iso: string, locale?: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    return date.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}
