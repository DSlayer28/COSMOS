# Architecture & Code Decisions Log

This document tracks all meaningful technical decisions, architecture choices, and code changes made by the AI during the development of this codebase. It serves as a historical record of "why" certain paths were chosen.

## Format

*   **Date**: When the decision was made.
*   **Context/Problem**: What issue we were trying to solve or what feature we were adding.
*   **Decision**: The actual change or technical choice made.
*   **Reasoning**: Why this approach was chosen over alternatives.

---

### [Initial Setup] - 2026-09-02

*   **Context/Problem**: The user requested a centralized way to track AI-driven codebase changes and architectural decisions to maintain context and understand reasoning over time.
*   **Decision**: Created this `decisions.md` file at the root of the project.
*   **Reasoning**: A markdown file in the root directory is standard practice for project-wide documentation (like `README.md` or `CHANGELOG.md`). It ensures developers (and the AI itself in future sessions) can easily find and reference past decisions without digging through commit histories or chat transcripts.

### [Bug Fix: Missing Tailwind Dependencies] - 2026-09-02

*   **Context/Problem**: Running `npm run dev` in the frontend failed because the Vite configuration imported `@tailwindcss/vite`, but the package was missing from `package.json`.
*   **Decision**: Ran `npm install tailwindcss @tailwindcss/vite` in the `frontend/cosmos` directory.
*   **Reasoning**: The frontend relies on Tailwind CSS for styling (as seen in the class names and `vite.config.ts`), so we needed to add the missing dependencies to allow Vite to build and run the development server.

### [Feature: Local User Database] - 2026-09-02

*   **Context/Problem**: The app needed persistence for users so coordinators can see who is connected, where they are, and their status even after a server restart, without losing offline capability.
*   **Decision**:
    *   Initially attempted `better-sqlite3`, but it caused a `napi_fatal_error` when packaged via `pkg` due to native binary loading issues on Windows.
    *   Fell back to a simple, pure-JavaScript JSON file store (`fs.readFileSync` and `fs.writeFileSync`) in `backend/src/db.ts` to guarantee seamless `pkg` compatibility without native dependency headaches.
    *   Updated the client (`frontend/cosmos/src/socket.ts`) to generate a persistent UUID stored in `localStorage` to identify returning users across sessions and reloads.
    *   **Privacy**: Decided *not* to broadcast `medical_notes` in `users-history` or `user-updated` events. These are kept entirely server-side in the DB. Only non-sensitive user data is sent to all LAN clients, ensuring medical details aren't publicly exposed to anyone sniffing the open local network.
*   **Reasoning**: `pkg` is notoriously flaky with native `.node` addons. For a local LAN app with dozens to hundreds of users, a synchronous JSON file store is more than performant enough, has zero setup, and completely bypasses all packaging risks. We scoped the change to *only* users (chat and pins remain in-memory for now) to introduce DB persistence safely without breaking existing flows. Privacy on an unauthenticated LAN requires strictly restricting what gets broadcast.

### [Feature: Phase 01 Core Request Model] - 2026-09-02

*   **Context/Problem**: Added the foundational core model for tracking disaster requests (requests for help or resources) without building the UI yet.
*   **Decision**:
    *   Defined the types (`DisasterRequest`, `PriorityLevel`, `RequestCategory`, `RequestStatus`) in a new `backend/src/shared/types.ts` file.
    *   Configured `vite.config.ts` to allow `../..` via `server.fs.allow` so the frontend can import these types without triggering Vite security restrictions.
    *   Added `requests` as an in-memory store in `backend/src/index.ts` alongside chat and pins. Purposefully did not use `db.ts` to persist this, per the spec for this phase.
    *   Implemented `create-request`, `update-request`, and `request-requests-history` socket events, with server-side validation to ensure client-supplied data is not blindly trusted (e.g., retrieving the username from the DB, computing base priority).
    *   Fixed a pre-existing unused variable TypeScript error in `Map.tsx` (`username` in `ClickToAddPin`) that caused the frontend build to fail.
*   **Reasoning**: Keeping shared types in a simple folder ensures strong type-checking for Socket.io payloads between the client and server without the overhead of a full monorepo workspace. Server-side validation protects the state in an open LAN network from malformed or spoofed payloads.

### [Feature: Phase 02 Request UX Update] - 2026-09-02

*   **Context/Problem**: Added the frontend UI layer for the Disaster Request system built in Phase 01. Replaced the legacy `window.prompt` pin flow with structured requests and provided an aggregated "Needs Help" view.
*   **Decision**:
    *   Updated `RequestStatus` in `types.ts` and `index.ts` to exactly match the spec lifecycle: `open`, `acknowledged`, `in_progress`, `resolved`, `cancelled`.
    *   Created `RequestModal.tsx` for creating requests via a structured form, and `RequestCard.tsx` for viewing details and interactive lifecycle actions (Acknowledge, I Can Help, Resolve, Escalate).
    *   Created `RequestListPanel.tsx` as a slide-over panel in `Map.tsx` to list active requests sorted strictly by effective priority -> escalation count -> age -> people affected.
    *   Updated the map's click handler to trigger `RequestModal` instead of the legacy `prompt()`. Legacy pins still render from history, but new interactions use the request flow.
    *   Updated `index.ts` to include strict tracking (15-minute cooldown) for the manual "Still Need Help" escalation action.
    *   Fixed `type-only` import warnings in React components generated by Vite's `verbatimModuleSyntax`.
*   **Reasoning**: Rendering the list view as an overlay directly inside `Map.tsx` maintains situational awareness, ensuring users don't lose sight of the map while coordinating emergency responses. Adding a 15-minute server-side validation cooldown for escalation prevents spamming the network and distorting priorities.

### [Feature: Phase 03 Time Based Logic] - 2026-09-02

*   **Context/Problem**: The application needed to self-regulate active requests by automatically escalating priorities based on age and expiring requests that are too old, ensuring the network isn't clogged with stale requests and that critical waiting requests gain visibility.
*   **Decision**:
    *   Added configurable backend constants: `EVALUATION_INTERVAL_MS` (60s), `DEFAULT_EXPIRY_MS` (24h), and escalation thresholds at 60 and 120 minutes.
    *   Implemented a server-side `setInterval` loop that iterates over active requests every minute.
    *   Auto-escalation bumps priority (capped at 1/CRITICAL) for aging requests, explicitly excluding `LOW` (priority 5) requests from auto-escalating to avoid false emergencies.
    *   Requests older than their expiry are moved to a new `'expired'` status, ceasing escalation.
    *   Updated `RequestModal.tsx` to include an "Expires In" dropdown for custom expiry times.
    *   Updated `RequestCard.tsx` to display a "Stale" indicator if a request is older than 60 minutes and unresolved. Expired requests now show a "Renew Request" button for the original requester.
*   **Reasoning**: A background polling mechanism allows the system to remain autonomous even if clients disconnect, which is vital in disaster scenarios. The exclusion of `LOW` priority requests from auto-escalation prevents minor issues from overtaking genuine medical or rescue emergencies.

### [Feature: Phase 04 Resource Aggregator] - 2026-09-02

*   **Context/Problem**: The map needed to display infrastructural community resources (e.g., hospitals, relief centers) distinct from dynamic user requests, allowing users to verify their operational status and available services.
*   **Decision**:
    *   Added `ResourceAggregator` types and updated `index.ts` to statically load resources into memory from a mock `backend/data/resources.json` on startup. 
    *   Configured `package.json` to bundle `data/resources.json` as a `pkg` asset so it is preserved in the compiled executable.
    *   Built `ResourceCard.tsx` to display resource details, service availability, and last verification timestamp. Any user can interact with the card to update the resource's status (`OPEN`, `LIMITED`, `CLOSED`), which updates the verification timestamp and broadcasts it instantly to all clients.
    *   Visually separated resources on the map using square markers (color-coded by status) to contrast heavily with the circular markers used for requests.
*   **Reasoning**: Keeping resource creation out of the UI prevents map clutter and abuse during an emergency. Pre-seeding them from a local JSON allows administrators to define verified community assets while empowering the users on the ground to crowd-source their real-time operational status.

### [Feature: Phase 05 Request/Resource Matching] - 2026-09-02

*   **Context/Problem**: Active requests needed a way to intelligently connect with the statically seeded community resources based on proximity and operational status, so that responders are guided toward available help.
*   **Decision**: 
    *   Implemented a local Haversine distance calculator directly in the frontend (`utils.ts`) instead of relying on external map APIs.
    *   Linked `RequestCategory` types directly to `ResourceType` arrays in a lookup map (e.g. `medical -> ['HOSPITAL', 'CLINIC', 'PHARMACY']`).
    *   Embedded a dynamically sorted "Nearby Help" list within the `<RequestCard />` that surfaces the top 3 best resources based on Availability (`OPEN` > `LIMITED`), Relevance (from the lookup map), Distance, and Verification Age.
    *   Added browser `navigator.geolocation` parsing in `<Map />` to determine the user's physical distance to a tapped `<ResourceCard />`.
*   **Reasoning**: Keeping distance calculations and matching algorithms entirely on the client side ensures zero dependency on external routing APIs, preserving the LAN-only constraint of the offline architecture. By surfacing relevant resources *inside* the Request card, it drastically reduces cognitive load for volunteers deciding how to assist.

### [Feature: Phase 06 Dashboard & Chat Integration] - 2026-09-02

*   **Context/Problem**: The application lacked a unified operational view. Responders needed a high-level summary of network activity (online users, active emergencies, resources) immediately upon opening the app, and the Chat needed a way to share structured data rather than forcing users to type out coordinates manually.
*   **Decision**: 
    *   Redesigned `<Dashboard />` to subscribe directly to `requests-history`, `resources-history`, and `users-history`. Added "Quick Action" buttons that append a `?intent=[category]` parameter to the URL and redirect to the `<Map />`.
    *   Updated the backend `ChatMessage` type to include a structured `attachment` payload `{ type: 'request' | 'resource', id: string }`.
    *   Built a sliding "Available Resources" drawer into the `<Chat />` interface that filters for `OPEN`/`LIMITED` resources, allowing users to broadcast them to the chat room instantly.
    *   Implemented an `<AlertBanner />` at the root `<App />` level that listens for new/escalated `CRITICAL` requests and triggers a local HTML5 `AudioContext` beep, avoiding the need for external push notification services or MP3 assets.
*   **Reasoning**: Using `?intent=` query parameters cleanly bridges the gap between the Dashboard's high-level intent and the Map's coordinate-gathering requirement without introducing complex global state management. Using native `AudioContext` keeps the `.exe` package size small and entirely independent of external static asset hosting.

### [Feature: Phase 07 UI Polish] - 2026-09-02

*   **Context/Problem**: The application lacked robust accessibility, had a cluttered map when data scaled up, and lacked intuitive list sorting options.
*   **Decision**: 
    *   Implemented a unified global search bar on `<Map />` that simultaneously filters both the visual map markers and the entries within the `<RequestListPanel />`.
    *   Added dedicated UI toggles for filtering by Priority, Category, and Resource Type.
    *   Updated `utils.ts` and UI components to display universally understood symbols (⚠️, 🚨, 🔴, 🟠, 🟡) instead of relying solely on colors to convey priority severity (for colorblind accessibility).
    *   Added high-contrast `focus-visible` rings and ARIA labels across interactive components (`Map`, `Dashboard`, `Chat`, `AlertBanner`, `RequestCard`, `ResourceCard`) for better keyboard navigation.
    *   Added "Nearest" sorting (dependent on `userLocation`) to the "Needs Help" panel.
*   **Reasoning**: A single global search input reduces cognitive load compared to independent search fields for requests vs. resources. Enforcing focus rings and emoji/symbol-based priority indicators ensures the application remains usable in high-stress, low-visibility environments and conforms to basic WCAG standards without adding massive UI libraries.

### [Phase 08 Testing and Documentation] - 2026-09-02

*   **Context/Problem**: The application required final verification of core logic and comprehensive documentation before delivery.
*   **Decision**: 
    *   Wrote a Node.js `test_scenarios.js` script using `socket.io-client` to programmatically verify base priority assignment, Request update/escalation logic, and Resource status broadcast integrity, rather than relying solely on manual UI clicks.
    *   Rewrote `PROJECT.md` completely to reflect the new `DisasterRequest` and `ResourceAggregator` models, removing outdated pin references.
    *   Updated `FLOW.md` to precisely track the lifecycle of a Request and Resource through the WebSocket network.
*   **Reasoning**: Programmatic socket testing ensures the backend rules engine (which enforces priority caps and aging) works independently of the frontend UI, validating the system's resilience against malformed or out-of-order client events.

### [Bug Fix: LAN Connectivity and Socket Issues] - 2026-09-03

*   **Context/Problem**: Devices on the LAN couldn't access Vite, the backend socket connection failed on non-5173 dev ports, and the Chat component created duplicate user records on navigation.
*   **Decision**: Fixed three isolated bugs across the stack.
*   **Reasoning**: 
    *   Added `host: true` to Vite config so the dev server listens on all network interfaces (0.0.0.0) instead of just localhost.
    *   Updated `backendUrl` in `socket.ts` to check `port !== '3001'` to ensure proper routing regardless of Vite's dynamic dev port.
    *   Included persistent `userId` in `Chat.tsx` socket query to prevent the backend from generating a new UUID on every chat mount.

### [Feature: Live User Locations] - 2026-09-03

*   **Context/Problem**: Users needed to see where other connected responders were in real-time, but without clogging the network with rapid updates or exposing sensitive medical information to the entire LAN.
*   **Decision**: 
    *   Implemented `navigator.geolocation.watchPosition` on the client.
    *   Added explicit throttling: clients only emit `location-update` if they have moved > 20 meters or if > 15 seconds have passed since the last emit.
    *   Used Leaflet's `<Tooltip>` (hover) for user markers instead of `<Popup>` (click) to ensure glanceability.
    *   Explicitly omitted `medical_notes` from the socket broadcast via `stripSensitiveData` in `db.ts`, enforcing server-side privacy boundaries.
*   **Reasoning**: Strict distance/time throttling prevents the socket server from being flooded by GPS ticks (which can fire every second). Hover tooltips reduce friction when a coordinator needs to quickly scan the map to see who is where. Excluding medical notes ensures no sensitive data is leaked to unauthorized clients.
