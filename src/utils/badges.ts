import { useEffect, useState } from "react";
import UsersService, { BadgeInfo } from "../services/UsersService";

/** Loads the badge catalogue (`GET /badges`); a failure leaves only the earned badges visible. */
export function useBadgeCatalogue(): BadgeInfo[] {
    const [catalogue, setCatalogue] = useState<BadgeInfo[]>([]);
    useEffect(() => {
        let ignore = false;
        UsersService.getBadges()
            .then((data) => {
                if (!ignore) {
                    setCatalogue(data.payload);
                }
            })
            .catch((error) => console.error(error));
        return () => {
            ignore = true;
        };
    }, []);
    return catalogue;
}
