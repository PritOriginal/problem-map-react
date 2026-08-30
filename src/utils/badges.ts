import UsersService, { BadgeInfo } from "../services/UsersService";
import { useT } from "../i18n";
import { useAsyncData } from "./use-async-data";

/** One shared empty list, so a component holding the catalogue does not see a new one per render. */
const NONE: BadgeInfo[] = [];

/**
 * Loads the badge catalogue (`GET /badges`); a failure leaves only the earned badges visible.
 *
 * `lang` is a dependency because the badge names and descriptions are localized by the
 * backend: it is a dictionary like the ones `useDictionaryReload` refreshes, only one that
 * lives in a hook rather than a store.
 */
export function useBadgeCatalogue(): BadgeInfo[] {
    const { lang } = useT();
    // Silent on purpose: the catalogue only adds the not-yet-earned badges to the wall,
    // and its absence is not something to put in front of the user.
    const { data } = useAsyncData(
        (signal) => UsersService.getBadges({ signal }).then((res) => res.payload),
        [lang],
        { silent: true },
    );
    return data ?? NONE;
}
