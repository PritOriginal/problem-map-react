import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { useT } from "../../i18n";
import { Button } from "../button/button";
import {
    getConfirmRequest,
    registerHost,
    settleConfirm,
    subscribeConfirm,
    type ConfirmRequest,
} from "./confirm-store";
import "./confirm.scss";

/**
 * Renders the pending question, if any. Mounting it is optional -- `useConfirm` mounts one
 * itself when the tree has none -- but a tree that renders it keeps the dialog inside its
 * own React root, which is what a test rendering a whole screen wants.
 */
export function ConfirmHost(): ReactNode {
    const request = useSyncExternalStore(subscribeConfirm, getConfirmRequest, getConfirmRequest);

    useEffect(registerHost, []);

    if (request === null) {
        return null;
    }
    // Keyed by request id, so a second question never reuses the first one's <dialog>:
    // reusing it would leave the element open with the previous question's state.
    return <ConfirmDialog key={request.id} request={request} />;
}

function ConfirmDialog({ request }: { request: ConfirmRequest }) {
    const { t } = useT();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const { id, danger = false } = request;

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null) {
            return;
        }
        openModal(dialog);
        // Escape is handled here rather than left to the browser: `showModal` is missing
        // in jsdom (and in any environment without dialog support), and there the native
        // `cancel` event never fires. `settleConfirm` ignores the second answer when both
        // paths run, so keeping both costs nothing.
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                settleConfirm(id, false);
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            closeModal(dialog);
        };
    }, [id]);

    return (
        <dialog
            className="confirm"
            ref={dialogRef}
            data-danger={danger ? "true" : undefined}
            aria-labelledby={`confirm-question-${id}`}
            onCancel={(event) => {
                event.preventDefault();
                settleConfirm(id, false);
            }}
            onClick={(event) => {
                // A modal <dialog> covers the whole viewport; its backdrop is the part of
                // the element the inner box does not cover, so a click that lands on the
                // element itself is a backdrop click.
                if (event.target === dialogRef.current) {
                    settleConfirm(id, false);
                }
            }}
        >
            <div className="confirm__box">
                <p className="confirm__question" id={`confirm-question-${id}`}>{request.question}</p>
                <div className="confirm__actions">
                    <Button style="secondary" isMini onClick={() => settleConfirm(id, false)}>
                        {t("confirm.cancel")}
                    </Button>
                    <Button style={danger ? "negative" : "primary"} isMini onClick={() => settleConfirm(id, true)}>
                        {request.confirmLabel ?? t("confirm.ok")}
                    </Button>
                </div>
            </div>
        </dialog>
    );
}

function openModal(dialog: HTMLDialogElement): void {
    if (typeof dialog.showModal === "function") {
        try {
            dialog.showModal();
            return;
        } catch {
            // Already open, or the element is not in the document yet.
        }
    }
    dialog.setAttribute("open", "");
}

function closeModal(dialog: HTMLDialogElement): void {
    if (typeof dialog.close === "function" && dialog.open) {
        try {
            dialog.close();
            return;
        } catch {
            // Never opened; removing the attribute is enough.
        }
    }
    dialog.removeAttribute("open");
}
