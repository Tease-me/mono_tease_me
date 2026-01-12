# Copilot / AI Agent Instructions — TeaseMe frontend

Purpose: give an AI coding agent the immediate, practical context needed to be productive in this repository.

Quick start
- Dev server: `npm run start` (or `yarn start`) — app served by Vite (default port shown by Vite). ✅
- Build: `npm run build` / `yarn build`.
- Preview build: `npm run preview` / `yarn preview`.
- Lint: `npm run lint`.

Important env vars (required at runtime)
- See `src/env.ts` — missing variables will throw at import time.
- Required: VITE_* vars used in `env.ts` (examples):
  - `VITE_NEXT_PUBLIC_BLAND_API_KEY`, `VITE_BLAND_API_URL`, `VITE_BLAND_WEB_URL`, `VITE_BLAND_AGENT_LUNA`, `VITE_BLAND_AGENT_TEST`
  - `VITE_ELEVENLABS_API_KEY`, `VITE_ELEVENLABS_AGENT_ID`
  - `VITE_TEASE_ME_PROTOCOL`, `VITE_TEASE_ME_HOST`, `VITE_TEASE_ME_WS_PROTOCOL`
  - `VITE_FIREBASE_PUBLIC_KEY`

High-level architecture (what to know fast)
- UI: `src/ui/**` — screens, components, templates.
- Routing: `src/routes/AppRoutes.tsx` and `src/routes/path.ts` (React Router v7 patterns).
- API client layer: `src/api/apis.ts` (axios `apiClient`) and `src/api/urls.ts` (Endpoints & WS URLs).
- Services / API methods: `src/api/services/*` are factory functions (pattern: `const S = Service(apiClient)` returns methods).
- Data models: `src/api/models/*` contain request/response TypeScript types.
- Local data layer: `src/data/repositories/*` provide small repositories used by UI (e.g., `UserRepo`).
- Contexts: `src/context/*` (Auth, Video, etc.) manage shared state — prefer adding new global state here.
- Hooks: reusable hooks live under `src/hooks/*` (e.g., `useCall`, `useAudioRecorder`).
- Realtime: WebSockets are used for chat—see `src/ui/screens/messaging/components/ChatScreenContent.tsx`.

Key conventions & patterns
- Absolute imports: @/ maps to `./src` via `tsconfig.json` paths. Use `@/...` when possible.
- Service factory pattern: create service instance with `const auth = AuthServices(apiClient)` then call `auth.login(...)` (see `src/api/services/AuthServices.ts`).
- Types-first: responses are typed in `src/api/models/*` — use these types for services and UI.
- API auth: `apiClient` automatically adds `Authorization: Bearer <access_token>` from localStorage (see `src/api/apis.ts`). LocalStorage keys are in `src/constants/localStorageKeys.ts`.
- WebSockets use `WS_BASE_URL + Endpoints.ws.chat` and attach the JWT in a `?token=` query param (see ChatScreenContent). Keep host/protocol env vars consistent.
- Environment behavior: `src/env.ts` throws on missing env keys — when running locally, create `.env` with required VITE_* keys.
- Push notifications/service worker usage: AuthProvider registers/subscribes using `FIREBASE_PUBLIC_KEY` (see `src/context/AuthContext.tsx`).

Implementation notes & where to change things
- Add new REST endpoints: update `src/api/urls.ts` then implement methods in `src/api/services/<service>.ts` and types in `src/api/models`.
- Debugging WebSocket/chat issues: check `TEASE_ME_HOST` / `TEASE_ME_WS_PROTOCOL`, confirm token in `localStorage.access_token`, inspect network WS frames.
- If a change affects authentication flows, check `AuthProvider` in `src/context/AuthContext.tsx` (token refresh, storage keys, push subscription).

Developer workflow tips
- No built-in test script in package.json; add tests and scripts if needed.
- Use `yarn` (v1) or `npm` — lockfile not present here; packageManager points to `yarn@1.22.x`.
- Run `npm run lint` to catch TypeScript-eslint issues early; rules are defined in `eslint.config.ts`.

Notable external integrations
- Bland client: `bland-client-js-sdk` + BLAND env vars (persona/content agent integrations).
- ElevenLabs: TTS integration under `src/api/eleven/eleven.ts`, requires `VITE_ELEVENLABS_API_KEY`.
- WebSockets: server-side ws endpoints defined by `Endpoints.ws`.

Common pitfalls for agents
- Do not assume env vars are optional — `src/env.ts` will error on missing keys.
- When testing WS flows locally, ensure backend is available and TEASE_ME_HOST/PROTOCOL match (http/ws vs https/wss).
- Avoid adding global state libraries unless necessary; the repo prefers Context + small repo patterns.

Where to look first (quick map)
- `src/api/apis.ts` (axios client)
- `src/api/urls.ts` (endpoints)
- `src/api/services/*` (how endpoints are used)
- `src/api/models/*` (types)
- `src/context/AuthContext.tsx` (auth lifecycle)
- `src/ui/screens/messaging/components/ChatScreenContent.tsx` (WebSocket chat)
- `README.md` (setup + env examples)

If anything here is missing or unclear, tell me which area to expand (auth, chat, env, or service patterns) and I'll update this file.  

---

(Generated to help AI agents be productive fast; keep edits focused on concrete, discoverable patterns.)