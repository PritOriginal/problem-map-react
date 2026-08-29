/**
 * The single pending confirmation question.
 *
 * A replacement for `window.confirm`, which cannot be styled, blocks the whole thread and
 * is impossible to drive from a test. The question lives in this module-level slot rather
 * than in a React context, so `useConfirm` stays a plain call from any component and needs
 * no provider wrapped around the tree.
 */

export interface ConfirmOptions {
    /** The question itself, already translated. */
    question: string;
    /** Label of the confirming button; defaults to `confirm.ok`. */
    confirmLabel?: string;
    /** Marks the action as destructive: the confirming button turns into a negative one. */
    danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
    /** Identifies the request, so a late second answer to it can be ignored. */
    id: number;
    resolve: (value: boolean) => void;
}

let current: ConfirmRequest | null = null;
let sequence = 0;

const listeners = new Set<() => void>();

export function subscribeConfirm(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getConfirmRequest(): ConfirmRequest | null {
    return current;
}

function emit(): void {
    listeners.forEach((listener) => listener());
}

/**
 * Answers the request with the given id. The id check is what makes each promise resolve
 * exactly once: a second click, an Escape arriving together with the native `cancel`
 * event, or a backdrop click racing a button all carry the id of a request that is no
 * longer current, and are dropped.
 */
export function settleConfirm(id: number, value: boolean): void {
    if (current === null || current.id !== id) {
        return;
    }
    const { resolve } = current;
    current = null;
    emit();
    resolve(value);
}

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        // A question opened while another one is still up cancels the previous one:
        // leaving it unresolved would hang the caller awaiting it forever.
        if (current !== null) {
            settleConfirm(current.id, false);
        }
        sequence += 1;
        current = { ...options, id: sequence, resolve };
        emit();
    });
}

/**
 * The number of `ConfirmHost`s rendered by the application's own tree. While it is
 * positive `useConfirm` does not create its own host, so mounting `<ConfirmHost />` by
 * hand stays possible (and wins) without producing two dialogs.
 */
let mountedHosts = 0;

export function registerHost(): () => void {
    mountedHosts += 1;
    return () => {
        mountedHosts -= 1;
    };
}

export function hasMountedHost(): boolean {
    return mountedHosts > 0;
}
