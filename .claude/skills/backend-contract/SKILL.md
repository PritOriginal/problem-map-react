---
name: backend-contract
description: Backend API contract for problem-map-react — response envelope, unwrapList/unwrapOne, auth, ETag cache, Idempotency-Key, language header, and the rule that every service method needs a contract test. Load whenever touching src/services/** or src/offline/**.
user-invocable: false
---

# Backend contract (problem-map-react)

All requests go to relative `/api/...` (Vite proxies to `${API_HOST}:${API_PORT}`, stripping `/api`). No `VITE_API_URL`.

## Envelope (`src/services/http.ts`)
```ts
interface IResponse { success: boolean; error?: { message: string }; payload?: unknown; meta?: ListMeta /* {limit, offset, total} */ }
```
- `parseResponse` throws `ApiError(message, status, payload)` on non-OK **or** `success: false`. Error payload is preserved (e.g. `similar_marks` on 409).
- Lists come keyed by collection name: `{ tasks: Task[] }`, `{ marks: Mark[] }`. Always unwrap with `unwrapList<T>(payload, "tasks")` — it also accepts a bare array and `null` → `[]`.
- Single objects: `unwrapOne<T>(payload, "user")` (keyed or bare; `null` → `null`).
- Never read `payload.foo` directly in stores/components; the service returns already-unwrapped data.

## BaseService (`src/services/BaseService.ts`)
- `request` — anonymous; `requestWithAuth` / `fetchWithAuth` — Bearer + pre-emptive refresh, one retry on 401, sign-out on second 401.
- `requestCached` — GET with `If-None-Match`, body+ETag stored in localStorage under `etag:v2:<lang>:<url>`. Use for read-only dictionaries (statuses, mark types). Bump `ETAG_PREFIX` if the cached payload shape changes.
- `withLang(init)` adds the language header from `src/i18n` — every request must go through `BaseService` helpers, never raw `fetch` in a service.
- `withIdempotencyKey` — for mutations that can be replayed from the offline queue (`src/offline/queue.ts`, `createQueuedItem`); the queued item id **is** the `Idempotency-Key`, a retry reuses it.
- Tokens: `src/services/tokens.ts` (JWT access/refresh in localStorage, role from claims via `src/utils/role.ts`).

## Mandatory when adding/changing a service method
1. Add a case to `src/services/contracts.test.ts` (mock global `fetch`, assert exact URL, method, query/body and the unwrapped result). Pattern: `ok(payload, meta)` helper + `expect(fetchMock.mock.calls[0][0]).toBe("/api/...")`.
2. Document the endpoint in a JSDoc on the method (`/** GET /tasks/user/{id} returns { tasks: Task[] } */`).
3. Types live next to the service (`export interface Task`), `snake_case` fields as the backend sends them; normalize in a `normalizeX` helper only if the UI needs it (see `normalizeOrganization`, `normalizeLeaderboard`).
4. Any user-visible string → key in **both** `src/i18n/ru.ts` and `src/i18n/en.ts` (`parity.test.ts` fails otherwise; placeholders `{name}` must match).
5. Run `npm test -- --run src/services` before finishing.
