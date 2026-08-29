import { useCallback } from "react";
import { createRoot, type Root } from "react-dom/client";

import { askConfirm, hasMountedHost, type ConfirmOptions } from "./confirm-store";
import { ConfirmHost } from "./confirm-host";

export type { ConfirmOptions } from "./confirm-store";

let lazyRoot: Root | null = null;

/**
 * Mounts a host on first use. The alternative -- requiring `<ConfirmHost />` somewhere in
 * `App` -- makes the hook silently do nothing wherever that mount was forgotten, and the
 * failure only surfaces at the moment a user is asked to confirm something.
 */
function ensureHost(): void {
    if (hasMountedHost() || lazyRoot !== null || typeof document === "undefined") {
        return;
    }
    const container = document.createElement("div");
    container.className = "confirm-root";
    document.body.appendChild(container);
    lazyRoot = createRoot(container);
    lazyRoot.render(<ConfirmHost />);
}

/**
 * Returns `confirm({ question })`: shows a modal dialog and resolves to the user's answer.
 * A drop-in replacement for `window.confirm`, which cannot be styled, blocks the thread
 * and cannot be driven from a test. The returned function is stable, so it is safe to put
 * in a dependency list.
 */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
    return useCallback((options: ConfirmOptions) => {
        ensureHost();
        return askConfirm(options);
    }, []);
}
