/**
 * Nullable integer as serialized by the backend (guregu/null).
 * Normally it is a plain number or null, but some serializers emit the struct form
 * `{ Int64, Valid }` / `{ V, Valid }` (or lowercase keys), so all variants are accepted.
 */
export type NullableInt =
    | number
    | null
    | undefined
    | { Int64?: number; int64?: number; V?: number; v?: number; Valid?: boolean; valid?: boolean };

/** Normalizes a NullableInt value to `number | null`. */
export function nullableInt(value: NullableInt): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "object") {
        const valid = value.Valid ?? value.valid;
        if (valid === false) {
            return null;
        }
        const raw = value.Int64 ?? value.int64 ?? value.V ?? value.v;
        return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    }
    return null;
}
