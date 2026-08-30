import type { UserBadge, UserLevel, UserProfile } from "../services/UsersService";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function num(value: unknown, fallback: number = 0): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback: string = ""): string {
    return typeof value === "string" ? value : fallback;
}

/** Level with defaults: a backend without levels yields level 1 without a next threshold. */
export function parseLevel(value: unknown): UserLevel {
    const raw = isRecord(value) ? value : typeof value === "number" ? { number: value } : {};
    const next = raw.next_threshold;
    return {
        number: Math.max(1, Math.floor(num(raw.number ?? raw.level, 1))),
        name: str(raw.name),
        next_threshold: typeof next === "number" && Number.isFinite(next) ? next : null,
    };
}

export function parseBadge(value: unknown): UserBadge | null {
    if (!isRecord(value) || typeof value.code !== "string") {
        return null;
    }
    return {
        code: value.code,
        name: str(value.name, value.code),
        description: str(value.description),
        icon: str(value.icon),
        earned_at: str(value.earned_at),
    };
}

/**
 * Normalizes a public profile payload (`GET /users/{id}/profile`). Missing lists become empty,
 * `level` may come as an object or a bare number, `stats` is kept as-is (partial).
 */
export function parseProfile(payload: unknown): UserProfile {
    const raw = isRecord(payload) ? (isRecord(payload.profile) ? payload.profile : payload) : {};
    const badges = Array.isArray(raw.badges) ? raw.badges.map(parseBadge).filter((b): b is UserBadge => b !== null) : [];
    return {
        user_id: num(raw.user_id),
        username: str(raw.username),
        rating: num(raw.rating),
        level: parseLevel(raw.level),
        badges,
        stats: isRecord(raw.stats) ? (raw.stats as UserProfile["stats"]) : {},
        member_since: str(raw.member_since),
    };
}

export interface LevelProgress {
    /** 0..1 share of the way from the current level's start to `next_threshold`; 1 on the last level. */
    ratio: number;
    /** Rating still missing to the next level; 0 when there is none. */
    remaining: number;
}

/**
 * Progress towards the next level. `prevThreshold` is the rating at which the current level
 * started (0 when unknown, so the bar simply shows rating / next_threshold).
 */
export function levelProgress(rating: number, level: UserLevel, prevThreshold: number = 0): LevelProgress {
    if (level.next_threshold === null || level.next_threshold <= prevThreshold) {
        return { ratio: 1, remaining: 0 };
    }
    const span = level.next_threshold - prevThreshold;
    const done = Math.min(Math.max(rating - prevThreshold, 0), span);
    return { ratio: done / span, remaining: Math.max(level.next_threshold - rating, 0) };
}

/** Badge icon: an emoji as-is, an icon code (e.g. `star`) becomes its first letters in a circle. */
export function badgeGlyph(icon: string, code: string): string {
    const source = icon.trim() || code;
    if (source === "") {
        return "★";
    }
    // anything outside the Latin/Cyrillic alphabet range is most likely an emoji: show it as-is
    return /^[\p{L}\p{N}_-]+$/u.test(source) ? source.slice(0, 2).toUpperCase() : source;
}
