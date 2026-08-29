---
name: add-endpoint
description: Add a new backend endpoint method to a service in src/services with its contract test and i18n keys. Usage - /add-endpoint <Service> <METHOD> </path> [payload key]
disable-model-invocation: true
---

# /add-endpoint $ARGUMENTS

Follow the `backend-contract` skill rules. Steps:

1. Parse arguments: service class (e.g. `TasksService`), HTTP method, path (relative to `/api`), optional payload key (e.g. `tasks`).
2. In `src/services/<Service>.ts`:
   - add request/response interfaces (`GetXRequest`, `GetXResponse extends IResponse { payload: X[] }`);
   - add the method using `this.requestWithAuth` (or `request` for public, `requestCached` for dictionaries, `withIdempotencyKey` for offline-replayable mutations);
   - build query strings with `URLSearchParams`, unwrap via `unwrapList`/`unwrapOne`;
   - JSDoc with the endpoint and payload shape.
3. In `src/services/contracts.test.ts` add an `it(...)` inside `"service payloads match the backend contract"` asserting URL, method, headers/body and the unwrapped result. Also cover an error case if the endpoint has a distinctive error payload.
4. If the feature adds UI text, add keys to `src/i18n/ru.ts` and `src/i18n/en.ts`.
5. Run `npm test -- --run src/services src/i18n` and `npx tsgo --noEmit -p tsconfig.app.json`; show the results.
