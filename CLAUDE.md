# problem-map-react

Frontend (React 18 + Vite 5 + TypeScript, MobX, Yandex Maps v3) for the "problem map" service: citizens place marks on a map, organizations get tasks, moderation/analytics/leaderboard panels.

## Commands
- `npm run dev` — Vite dev server (`APP_HOST`/`APP_PORT` from `.env`; `/api` proxied to `API_HOST:API_PORT`)
- `npm run build` — `tsgo -b && vite build` (typecheck: `npx tsgo --noEmit -p tsconfig.app.json`)
- `npm run lint` / `npm run lint-fix` — eslint 9 flat config
- `npm test -- --run` — vitest (jsdom); single file: `npm test -- --run src/services/contracts.test.ts`

## Layout
- `src/services/` — one class per domain extending `BaseService.ts`; `http.ts` holds the response envelope + `unwrapList`/`unwrapOne`; `tokens.ts` JWT storage. Contract rules: `.claude/skills/backend-contract/SKILL.md`.
- `src/store/` — MobX stores (`mobx-persist-store`), one per domain.
- `src/components/` — UI; screen-level panels in `src/components/panel/panels/`. `src/Map.tsx` — the map (large, edit carefully).
- `src/utils/` — pure helpers, each with a colocated `*.test.ts`.
- `src/offline/` — IndexedDB queue of mutations with `Idempotency-Key`.
- `src/i18n/` — custom dictionaries `ru.ts` (reference) / `en.ts`; `parity.test.ts` enforces identical key sets and placeholders.
- `src/lib/ymaps.ts`, `src/pwa.ts` + `public/sw.js`.

## Conventions
- Strict TS (`noUnusedLocals`, `noUnusedParameters`); 4-space indent, double quotes, semicolons.
- Every user-visible string goes through `t("key")` and exists in both dictionaries.
- Every new/changed service method gets a case in `src/services/contracts.test.ts` (see `/add-endpoint`).
- Tests are colocated (`foo.test.ts` next to `foo.ts`); mock `fetch` globally, never hit the network.
- Never edit `.env` or `package-lock.json` by hand (hooks block it).
- Branch flow: feature branches → `dev` → PR to `main` (deploy on push to `main`).

## Claude Code setup
- Hooks: eslint --fix + tsgo after each edit in `src/`; `.env`/lockfile edits blocked (`.claude/settings.json`).
- Skills: `backend-contract` (auto), `/add-endpoint`.
- Agents: `contract-reviewer`, `i18n-checker`.
- MCP: `github` (`.mcp.json`, needs `GITHUB_MCP_TOKEN` env var with a PAT), `context7` plugin for library docs.
