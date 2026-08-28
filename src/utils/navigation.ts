import { useCallback } from "react";
import { NavigateOptions, To, useLocation, useNavigate } from "react-router-dom";

/** Builds a `To` for the given path that keeps the current query string (map filters). */
export function useToKeepSearch(): (pathname: string) => To {
    const { search } = useLocation();
    return useCallback((pathname: string) => ({ pathname, search }), [search]);
}

/** `useNavigate` variant that keeps the current query string (map filters) when navigating by path. */
export function useNavigateKeepSearch(): (to: string | number, options?: NavigateOptions) => void {
    const navigate = useNavigate();
    const toKeepSearch = useToKeepSearch();
    return useCallback((to: string | number, options?: NavigateOptions) => {
        if (typeof to === "number") {
            navigate(to);
        } else {
            navigate(toKeepSearch(to), options);
        }
    }, [navigate, toKeepSearch]);
}
