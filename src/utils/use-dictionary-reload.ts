import { useEffect, useRef } from "react";

import { useT } from "../i18n";
import markTypesStore from "../store/mark-types";
import markStatusesStore from "../store/mark-statuses";
import organizationsStore from "../store/organizations";
import taskStatusesStore from "../store/task-statuses";
import adminBoundariesStore from "../store/admin-boundaries";
import user from "../store/user";

/**
 * Reloads every dictionary the backend localizes when the UI language changes.
 *
 * The names come from the server, chosen by `Accept-Language` (see `withLang`), so
 * switching the language has to ask for them again — nothing about them is translated
 * on the client. The initial load is not done here: each screen loads what it needs on
 * mount, and this hook only reacts to the *change*, hence the ref rather than a plain
 * effect that would re-fetch everything once more right after startup.
 *
 * Every dictionary below is listed on purpose, including the ones that look like plain
 * numbers: `admin_boundaries` and their mark counts both carry a `name`, and the counts
 * were the pair that used to stay in the previous language.
 *
 * The stores that guard against a repeat load (`loaded`/`inFlight`) are called with
 * `force`, or the call would be swallowed and nothing would be reloaded at all.
 */
export function useDictionaryReload(): void {
    const { lang } = useT();
    const loadedLang = useRef(lang);

    useEffect(() => {
        if (loadedLang.current === lang) {
            return;
        }
        loadedLang.current = lang;
        markTypesStore.fetch(true);
        markStatusesStore.fetch(true);
        organizationsStore.fetch(true);
        adminBoundariesStore.fetchBoundaries(true);
        // no load-once guard: the counts are re-read on every filter change anyway
        adminBoundariesStore.fetchMarksCount();
        if (user.id !== 0) {
            // authenticated endpoint, and likewise unguarded
            taskStatusesStore.fetch();
        }
    }, [lang]);
}
