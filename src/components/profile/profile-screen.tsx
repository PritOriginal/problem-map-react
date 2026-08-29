import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { UserBadge, UserLevel, UserStats } from "../../services/UsersService";
import { BadgesBlock, LevelBlock, ProfileStats } from "./profile-blocks";
import { useBadgeCatalogue } from "../../utils/badges";
import { useToKeepSearch } from "../../utils/navigation";
import { useT } from "../../i18n";

/** What both profile screens need of a profile: the level bar and the badge grid. */
export interface ProfileHead {
    rating: number;
    level: UserLevel;
    badges: UserBadge[];
}

/**
 * The body both profile screens share: level, badges, statistics.
 *
 * `/profile` (own) and `/users/:id` (public) rendered these three blocks in the same
 * order with the same headings and the same link out to the leaderboard -- down to one
 * identical inline style object for the heading row, which is now `.section-title-row`.
 * The two screens still differ in their header and in what surrounds this, so what is
 * shared is the middle, not the whole panel.
 */
export function ProfileBody({ profile, stats, statsLoading = false, showLeaderboardLink = true }: {
    /** Absent on a backend without the level/badges endpoint: only the statistics show. */
    profile?: ProfileHead | null;
    /** `null`/`undefined` renders the "statistics unavailable" line -- a backend without
     *  the stats endpoint leaves the rest of the profile usable. */
    stats: Partial<UserStats> | null | undefined;
    /** While the stats request is in flight, say nothing rather than "unavailable". */
    statsLoading?: boolean;
    showLeaderboardLink?: boolean;
}): ReactNode {
    const { t } = useT();
    const toKeepSearch = useToKeepSearch();
    const catalogue = useBadgeCatalogue();

    return (
        <>
            {profile &&
                <>
                    <LevelBlock rating={profile.rating} level={profile.level} />
                    <hr />
                    <h2 className="section-title">{t("profile.badges")}<span className="section-title__count">({profile.badges.length})</span></h2>
                    <BadgesBlock badges={profile.badges} catalogue={catalogue} />
                    <hr />
                </>
            }
            <div className="section-title-row">
                <h2 className="section-title">{t("profile.stats")}</h2>
                {showLeaderboardLink && <Link className="section-title-row__link" to={toKeepSearch("/leaderboard")}>{t("profile.leaderboardLink")}</Link>}
            </div>
            {stats
                ? <ProfileStats stats={stats} />
                : !statsLoading && <p className="empty-state">{t("profile.statsUnavailable")}</p>
            }
        </>
    );
}

export default ProfileBody;
