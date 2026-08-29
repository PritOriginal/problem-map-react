import UsersService, { BadgeInfo } from "../services/UsersService";
import { useAsyncData } from "./use-async-data";

/** One shared empty list, so a component holding the catalogue does not see a new one per render. */
const NONE: BadgeInfo[] = [];

/** Loads the badge catalogue (`GET /badges`); a failure leaves only the earned badges visible. */
export function useBadgeCatalogue(): BadgeInfo[] {
    // Silent on purpose: the catalogue only adds the not-yet-earned badges to the wall,
    // and its absence is not something to put in front of the user.
    const { data } = useAsyncData(
        (signal) => UsersService.getBadges({ signal }).then((res) => res.payload),
        [],
        { silent: true },
    );
    return data ?? NONE;
}
