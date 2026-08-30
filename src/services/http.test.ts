import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, parseResponse } from "./http";
import BaseService from "./BaseService";

class TestService extends BaseService {
    ping() {
        return this.request("/api/ping");
    }
}

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("parseResponse / BaseService.request", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("resolves with the body on success", async () => {
        const body = { success: true, payload: { mark_id: 1 } };
        await expect(parseResponse(jsonResponse(body, 200))).resolves.toEqual(body);
    });

    it("rejects with ApiError carrying backend message and status", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
            jsonResponse({ success: false, error: { message: "mark not found" } }, 404),
        ));

        const error = await new TestService().ping().catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toBeInstanceOf(Error);
        expect((error as ApiError).message).toBe("mark not found");
        expect((error as ApiError).status).toBe(404);
    });

    it("falls back to status text when body is not JSON", async () => {
        const response = new Response("<html>oops</html>", { status: 502, statusText: "Bad Gateway" });
        const error = await parseResponse(response).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe("Bad Gateway");
        expect((error as ApiError).status).toBe(502);
    });

    it("rejects when body reports success: false even with HTTP 200", async () => {
        const error = await parseResponse(jsonResponse({ success: false, error: { message: "bad" } }, 200)).catch((e: unknown) => e);
        expect((error as ApiError).message).toBe("bad");
        expect((error as ApiError).status).toBe(200);
    });
});
