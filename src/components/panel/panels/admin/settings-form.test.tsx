import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsForm } from "./settings-form";
import { resetStores } from "../../../../test/render";
import { jsonResponse, envelope } from "../../../../test/fetch";
import { saveTokens } from "../../../../services/tokens";
import { EMPTY_SETTINGS } from "../../../../utils/admin-settings";
import { TranslationKey, t } from "../../../../i18n";

/** How long the "saved" label stays up -- kept in step with settings-form.tsx. */
const OK_TIMEOUT_MS = 2500;

/** An unsigned JWT whose `exp` is far enough away for `ensureAccessToken` to accept it. */
function fakeAccessToken(): string {
    const b64 = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "");
    return `${b64({ alg: "none", typ: "JWT" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, role: "admin" })}.sig`;
}

/** `GET /api/admin/settings` answers with the defaults, `PUT` echoes what it was sent. */
function stubSettings(): void {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname !== "/api/admin/settings") {
            throw new Error(`No mock for ${url.pathname}`);
        }
        if ((init?.method ?? "GET").toUpperCase() === "GET") {
            return jsonResponse(envelope(EMPTY_SETTINGS));
        }
        return jsonResponse(envelope(JSON.parse(String(init?.body ?? "{}"))));
    }));
}

/**
 * The label markup is `<span>name</span><input><small>range</small>`, so the accessible
 * name of a field carries its hint too -- hence the substring match.
 */
function field(key: TranslationKey): HTMLInputElement {
    return screen.getByLabelText(t(key), { exact: false }) as HTMLInputElement;
}

const voteThreshold = () => field("admin.settings.vote_threshold");

/** Renders the form and waits for its first load to land. */
async function renderForm(): Promise<{ save: HTMLElement; reset: HTMLElement }> {
    render(<SettingsForm />);
    await waitFor(() => expect(screen.getByRole("button", { name: t("common.save") })).toBeInTheDocument());
    return {
        save: screen.getByRole("button", { name: t("common.save") }),
        reset: screen.getByRole("button", { name: t("admin.reset") }),
    };
}

describe("SettingsForm", () => {
    beforeEach(() => {
        resetStores();
        saveTokens(fakeAccessToken(), "refresh");
        vi.spyOn(console, "error").mockImplementation(() => {});
        stubSettings();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it("blocks saving while a value is out of range", async () => {
        const user = userEvent.setup();
        const { save } = await renderForm();

        // vote_threshold is 1..100 in SETTINGS_FIELDS
        await user.clear(voteThreshold());
        await user.type(voteThreshold(), "500");

        expect(voteThreshold()).toHaveValue(500);
        expect(save).toBeDisabled();
        expect(voteThreshold().closest("label")).toHaveClass("invalid");
    });

    it("is dirty only while the form differs from what was loaded", async () => {
        const user = userEvent.setup();
        const { save, reset } = await renderForm();

        expect(save).toBeDisabled();
        expect(reset).toBeDisabled();

        await user.clear(voteThreshold());
        await user.type(voteThreshold(), "7");
        expect(save).toBeEnabled();
        expect(reset).toBeEnabled();

        // back to the loaded value -- nothing changed after all
        await user.clear(voteThreshold());
        await user.type(voteThreshold(), String(EMPTY_SETTINGS.vote_threshold));
        expect(save).toBeDisabled();
        expect(reset).toBeDisabled();
    });

    it("puts the loaded values back when reset is pressed", async () => {
        const user = userEvent.setup();
        const { reset } = await renderForm();
        const ttl = field("admin.settings.tasker.task_ttl");

        await user.clear(voteThreshold());
        await user.type(voteThreshold(), "42");
        await user.clear(ttl);
        await user.type(ttl, "1h30m");
        expect(voteThreshold()).toHaveValue(42);
        expect(ttl).toHaveValue("1h30m");

        await user.click(reset);

        expect(voteThreshold()).toHaveValue(EMPTY_SETTINGS.vote_threshold);
        expect(ttl).toHaveValue(EMPTY_SETTINGS.tasker.task_ttl);
        expect(reset).toBeDisabled();
    });

    it("cancels the success timer when it unmounts", async () => {
        const setTimeoutSpy = vi.spyOn(window, "setTimeout");
        const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
        const user = userEvent.setup();
        const { save } = await renderForm();

        await user.clear(voteThreshold());
        await user.type(voteThreshold(), "7");
        await user.click(save);

        await waitFor(() => expect(screen.getByRole("button", { name: t("admin.settingsSaved") })).toBeInTheDocument());

        const index = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === OK_TIMEOUT_MS);
        expect(index).toBeGreaterThanOrEqual(0);
        const timerId = setTimeoutSpy.mock.results[index].value as number;

        cleanup();

        // Without the cleanup effect this id would still be pending and its callback
        // would call setOk on a component that no longer exists.
        expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);
    });
});
