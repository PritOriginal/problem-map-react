import { useCallback, useRef } from "react";
import { NavigateOptions, To, useLocation, useNavigate } from "react-router-dom";

/** Builds a `To` for the given path that keeps the current query string (map filters). */
export function useToKeepSearch(): (pathname: string) => To {
    const { search } = useLocation();
    return useCallback((pathname: string) => ({ pathname, search }), [search]);
}

/**
 * `useNavigate` variant that keeps the current query string (map filters).
 * The returned function has a stable identity: the search string is read through a ref.
 */
export function useNavigateKeepSearch(): (pathname: string, options?: NavigateOptions) => void {
    const navigate = useNavigate();
    const searchRef = useRef(useLocation().search);
    searchRef.current = useLocation().search;
    return useCallback((pathname: string, options?: NavigateOptions) => {
        navigate({ pathname, search: searchRef.current }, options);
    }, [navigate]);
}
