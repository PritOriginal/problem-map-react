import type { AdminSettings } from "../services/AdminService";

/** Numeric fields of the settings form with their allowed ranges (inclusive). */
export interface NumericField {
    /** Dotted path, e.g. `rating.check_correct`. */
    path: string;
    min: number;
    max: number;
    integer: boolean;
}

export const SETTINGS_FIELDS: readonly NumericField[] = [
    { path: "vote_threshold", min: 1, max: 100, integer: true },
    { path: "dedup_radius_m", min: 1, max: 5000, integer: true },
    { path: "max_checks_per_day", min: 1, max: 1000, integer: true },
    { path: "rating.check_correct", min: -1000, max: 1000, integer: true },
    { path: "rating.check_wrong", min: -1000, max: 1000, integer: true },
    { path: "rating.mark_confirmed", min: -1000, max: 1000, integer: true },
    { path: "rating.mark_refuted", min: -1000, max: 1000, integer: true },
    { path: "rating.task_completed", min: -1000, max: 1000, integer: true },
    { path: "tasker.max_tasks_per_user", min: 0, max: 100, integer: true },
    { path: "tasker.target_probability", min: 0, max: 1, integer: false },
    { path: "tasker.max_radius_meters", min: 1, max: 100000, integer: true },
];

/** Go duration: `1h30m`, `24h`, `90m`, `3600s`. */
export const DURATION_RE = /^(\d+h)?(\d+m)?(\d+s)?$/;

export function getPath(obj: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => (typeof acc === "object" && acc !== null ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

/** Returns a copy of `obj` with the value at `path` replaced. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
    const [head, ...rest] = path.split(".");
    const record = { ...(obj as Record<string, unknown>) };
    record[head] = rest.length === 0 ? value : setPath(record[head] ?? {}, rest.join("."), value);
    return record as T;
}

/** Field path -> error code (`range` / `integer` / `required` / `duration`); empty when valid. */
export function validateSettings(settings: AdminSettings): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of SETTINGS_FIELDS) {
        const value = getPath(settings, field.path);
        if (typeof value !== "number" || !Number.isFinite(value)) {
            errors[field.path] = "required";
        } else if (value < field.min || value > field.max) {
            errors[field.path] = "range";
        } else if (field.integer && !Number.isInteger(value)) {
            errors[field.path] = "integer";
        }
    }
    const ttl = settings.tasker?.task_ttl ?? "";
    if (ttl.trim() === "" || !DURATION_RE.test(ttl.trim())) {
        errors["tasker.task_ttl"] = "duration";
    }
    return errors;
}

export const EMPTY_SETTINGS: AdminSettings = {
    vote_threshold: 3,
    dedup_radius_m: 50,
    max_checks_per_day: 10,
    rating: { check_correct: 0, check_wrong: 0, mark_confirmed: 0, mark_refuted: 0, task_completed: 0 },
    tasker: { max_tasks_per_user: 3, target_probability: 0.5, max_radius_meters: 1000, task_ttl: "24h" },
};

/** Fills missing nested objects so the form never reads `undefined`. */
export function normalizeSettings(payload: unknown): AdminSettings {
    const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Partial<AdminSettings>;
    return {
        ...EMPTY_SETTINGS,
        ...raw,
        rating: { ...EMPTY_SETTINGS.rating, ...(raw.rating ?? {}) },
        tasker: { ...EMPTY_SETTINGS.tasker, ...(raw.tasker ?? {}) },
    };
}
