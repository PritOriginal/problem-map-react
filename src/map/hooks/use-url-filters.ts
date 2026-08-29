import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { filtersEqual, parseFilters, serializeFilters } from "../../utils/filters";
import marksStore, { DEFAULT_FILTERS } from "../../store/marks";

/**
 * Keeps the mark filters and `?types=&statuses=` in step, in one direction at a time:
 * the URL wins once, on mount, so a shared link opens with the filters it carries;
 * from then on the store is the source and is written back to the URL.
 *
 * The caller gets the serialized query back because it is the cheap way to depend on
 * "the filters changed" -- a string, not the observable arrays behind it.
 */
export function useUrlFilters(): { filtersQuery: string } {
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const fromUrl = parseFilters(searchParams, DEFAULT_FILTERS);
        if (!filtersEqual(fromUrl, marksStore.filters)) {
            marksStore.setFilters(fromUrl);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtersQuery = serializeFilters(marksStore.filters, DEFAULT_FILTERS).toString();
    useEffect(() => {
        setSearchParams((prev) => serializeFilters(marksStore.filters, DEFAULT_FILTERS, prev), { replace: true });
    }, [filtersQuery, setSearchParams]);

    return { filtersQuery };
}
