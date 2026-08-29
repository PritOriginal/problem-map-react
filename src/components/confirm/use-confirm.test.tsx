import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ConfirmHost } from "./confirm-host";
import { useConfirm, type ConfirmOptions } from "./use-confirm";

/**
 * A component that asks the question on mount and reports every answer it gets.
 * `ConfirmHost` is rendered here on purpose: the hook would mount one itself, but in its
 * own React root, and a root Testing Library does not own is neither flushed by `act` nor
 * torn down between tests.
 */
function Asker({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (value: boolean) => void }) {
    const confirm = useConfirm();
    return (
        <>
            <button type="button" onClick={() => { void confirm(options).then(onAnswer); }}>ask</button>
            <ConfirmHost />
        </>
    );
}

async function ask(options: ConfirmOptions = { question: "Delete it?" }) {
    const onAnswer = vi.fn();
    render(<Asker options={options} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: "ask" }));
    const dialog = await screen.findByRole("dialog", { hidden: true });
    return { dialog, onAnswer };
}

describe("useConfirm", () => {
    it("shows the question and opens the dialog", async () => {
        const { dialog } = await ask({ question: "Delete comment?" });
        expect(dialog).toHaveAttribute("open");
        expect(screen.getByText("Delete comment?")).toBeInTheDocument();
    });

    it("resolves to true on confirm", async () => {
        const { onAnswer } = await ask();
        fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
    });

    it("resolves to false on cancel", async () => {
        const { onAnswer } = await ask();
        fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    });

    it("resolves to false on Escape", async () => {
        const { onAnswer } = await ask();
        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    });

    it("resolves to false on a backdrop click", async () => {
        const { dialog, onAnswer } = await ask();
        fireEvent.click(dialog);
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    });

    it("uses confirmLabel when given", async () => {
        await ask({ question: "Merge?", confirmLabel: "Объединить" });
        expect(screen.getByRole("button", { name: "Объединить" })).toBeInTheDocument();
    });

    it("marks a destructive action", async () => {
        const { dialog } = await ask({ question: "Delete?", danger: true });
        expect(dialog).toHaveAttribute("data-danger", "true");
        expect(screen.getByRole("button", { name: "Подтвердить" })).toHaveClass("btn-negative");
    });

    it("leaves a non-destructive action unmarked", async () => {
        const { dialog } = await ask();
        expect(dialog).not.toHaveAttribute("data-danger");
        expect(screen.getByRole("button", { name: "Подтвердить" })).toHaveClass("btn-primary");
    });

    it("resolves exactly once when the confirm button is clicked twice", async () => {
        const { onAnswer } = await ask();
        const confirmButton = screen.getByRole("button", { name: "Подтвердить" });
        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);
        await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
        // Escape after the answer must not produce a second one either.
        fireEvent.keyDown(document, { key: "Escape" });
        await Promise.resolve();
        expect(onAnswer).toHaveBeenCalledTimes(1);
        expect(onAnswer).toHaveBeenCalledWith(true);
    });

    it("closes the dialog once answered", async () => {
        const { dialog } = await ask();
        fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
        await waitFor(() => expect(dialog).not.toBeInTheDocument());
    });
});
