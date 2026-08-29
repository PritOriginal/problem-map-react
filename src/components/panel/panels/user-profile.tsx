import { observer } from "mobx-react-lite";
import { useParams } from "react-router-dom";
import user from "../../../store/user";
import UsersService from "../../../services/UsersService";
import { ApiError } from "../../../services/http";
import { ProfileBody } from "../../profile/profile-screen";
import { useAsyncData } from "../../../utils/use-async-data";
import { localeOf, useT } from "../../../i18n";
import PanelHeader from "../panel-header";
import { AsyncState } from "../async-state";

/** `/users/:id`: public profile with level, badges and statistics (backend integration/wave-5). */
const UserProfilePanel = observer(function UserProfilePanel() {
    const { t, lang } = useT();
    const params = useParams();
    const id = Number(params.id);
    const { data, isLoading } = useAsyncData(
        (signal) => UsersService.getProfile(id, { signal })
            .then((res) => res.payload)
            // A 404 is "no such user", not a failure: it belongs in the panel's empty
            // state, and turning it into an absent profile here keeps it out of the
            // error banner the hook raises for everything else.
            .catch((error: unknown) => {
                if (error instanceof ApiError && error.status === 404) {
                    return null;
                }
                throw error;
            }),
        [id],
        { enabled: Number.isFinite(id) && id > 0, errorMessage: t("profile.publicLoadFailed") },
    );
    // While a new id is in flight the panel shows only its loader, as it did when the
    // effect blanked the profile before every request.
    const profile = isLoading ? null : data ?? null;
    const notFound = !isLoading && data === null;

    const subtitle = profile
        ? `${t("profile.rating")}: ${profile.rating}${profile.member_since ? ` · ${t("profile.memberSince")} ${new Date(profile.member_since).toLocaleDateString(localeOf(lang))}` : ""}`
        : t("profile.public");

    return (
        <>
            <PanelHeader
                openOnMount
                title={<>{profile?.username ?? t("profile.public")}{profile && profile.user_id === user.id && <i className="you-chip you-chip--on-chrome">{t("common.youShort")}</i>}</>}
                subtitle={subtitle}
            />
            <div className="panel__content">
                <AsyncState
                    isLoading={isLoading}
                    isEmpty={notFound || !Number.isFinite(id) || id <= 0}
                    empty={t("profile.notFound")}
                >
                    {profile && <ProfileBody profile={profile} stats={profile.stats} />}
                </AsyncState>
            </div>
        </>
    );
});

export default UserProfilePanel;
