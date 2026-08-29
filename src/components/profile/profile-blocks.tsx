import { UserBadge, UserLevel, BadgeInfo, UserStats } from "../../services/UsersService";
import { StatTile } from "../stat-tile/stat-tile";
import { badgeGlyph, levelProgress } from "../../utils/profile";
import { localeOf, useT } from "../../i18n";
import "./profile-blocks.scss";

/** Level name/number with a progress bar towards `next_threshold`. */
export function LevelBlock({ rating, level }: { rating: number; level: UserLevel }) {
    const { t } = useT();
    const progress = levelProgress(rating, level);
    const percent = Math.round(progress.ratio * 100);
    const title = level.name ? `${t("profile.levelN", { n: level.number })} · ${level.name}` : t("profile.levelN", { n: level.number });
    return (
        <div className="level-block">
            <div className="level-block__row">
                <p><b>{title}</b></p>
                <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {level.next_threshold === null ? t("profile.maxLevel") : `${rating} / ${level.next_threshold}`}
                </p>
            </div>
            <div className="level-block__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t("profile.level")}>
                <div className="level-block__fill" style={{ width: `${percent}%` }} />
            </div>
            {level.next_threshold !== null && <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>{t("profile.toNext", { n: progress.remaining })}</p>}
        </div>
    );
}

/** Earned badges; with a catalogue, the not-yet-earned ones are shown greyed out. */
export function BadgesBlock({ badges, catalogue = [] }: { badges: UserBadge[]; catalogue?: BadgeInfo[] }) {
    const { t, lang } = useT();
    const earned = new Map(badges.map((b) => [b.code, b]));
    const all: (BadgeInfo & { earned_at?: string })[] = catalogue.length > 0
        ? catalogue.map((b) => ({ ...b, ...(earned.get(b.code) ?? {}) }))
        : [...badges];
    // badges earned but absent from the catalogue are still shown
    for (const badge of badges) {
        if (catalogue.length > 0 && !catalogue.some((c) => c.code === badge.code)) {
            all.push(badge);
        }
    }
    if (all.length === 0) {
        return <p style={{ fontSize: 14 }}>{t("profile.noBadges")}</p>;
    }
    return (
        <div className="badges-grid">
            {all.map((badge) => {
                const got = badge.earned_at !== undefined && badge.earned_at !== "";
                const earnedText = got ? t("profile.badgeEarned", { date: new Date(badge.earned_at!).toLocaleDateString(localeOf(lang)) }) : "";
                const tooltip = [badge.name, badge.description, earnedText].filter(Boolean).join("\n");
                return (
                    <div key={badge.code} className={`badge-tile ${got ? "" : "locked"}`} title={tooltip} tabIndex={0} aria-label={tooltip}>
                        <span className="badge-tile__icon" aria-hidden="true">{badgeGlyph(badge.icon, badge.code)}</span>
                        <span className="badge-tile__name">{badge.name || badge.code}</span>
                    </div>
                );
            })}
        </div>
    );
}

/** Rows of the statistics grid for a (partial) `stats` object; unknown fields are skipped. */
export function ProfileStats({ stats }: { stats: Partial<UserStats> }) {
    const { t } = useT();
    const items: { key: string; label: string; value: number | string }[] = [];
    const add = (key: keyof UserStats, label: string) => {
        const value = stats[key];
        if (value !== undefined) {
            items.push({ key, label, value });
        }
    };
    add("tasks_completed", t("profile.stat.tasks"));
    add("marks_total", t("profile.stat.marks"));
    if (stats.marks_confirmed !== undefined || stats.marks_refuted !== undefined) {
        items.push({ key: "confirmed_refuted", label: t("profile.stat.confirmedRefuted"), value: `${stats.marks_confirmed ?? 0} / ${stats.marks_refuted ?? 0}` });
    }
    add("checks_total", t("profile.stat.checks"));
    add("checks_correct", t("profile.stat.correctChecks"));
    if (items.length === 0) {
        return <p style={{ fontSize: 14 }}>{t("profile.statsUnavailable")}</p>;
    }
    return (
        <div className="stat-grid">
            {items.map((item) => <StatTile key={item.key} value={item.value} label={item.label} />)}
        </div>
    );
}
