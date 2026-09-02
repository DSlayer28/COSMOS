# Application Execution Flow

This document maps out how execution travels through the COSMOS application, detailing the interaction between the frontend, backend, and specific modules.

## 1. Backend Startup (`backend/src/index.ts`)
1. **Server Initialization**: The Node.js application starts by executing `backend/src/index.ts`.
2. **Express & Static Files**: An Express app is created. It configures CORS and sets up static file serving for the compiled React frontend (`frontend/cosmos/dist`) and offline map tiles (`../tiles`).
3. **Socket.io Setup**: An HTTP server wraps the Express app, and Socket.io is attached to it to allow real-time WebSocket connections.
4. **Listening**: The server starts listening on port 3001. A helper function prints the local and network IPs to the console.
5. **Connection Handler (`io.on('connection')`)**: When a client connects, the backend:
    - Extracts the `userName` from the connection query parameters.
    - Immediately emits `chat-history` and `pins-history` to the connecting client.
    - Registers listeners for:
        - `request-chat-history`: Re-emits the chat history.
        - `request-pins-history`: Re-emits the pins history.
        - `user-message`: Pushes the new message to the in-memory array and broadcasts `server-message` to all *other* clients.
        - `add-pin`: Pushes the new pin to the in-memory array and broadcasts `pin-added` to *all* clients.
        - `create-request`: Validates and pushes new request to the in-memory array and broadcasts `request-created` to *all* clients.
        - `update-request`: Validates and modifies existing request and broadcasts `request-updated` to *all* clients.
        - `disconnect`: Logs the user out.

## 2. Frontend Startup
1. **Entry Point (`frontend/cosmos/src/main.tsx`)**: React mounts into the `#root` DOM element and renders the `<App />` component.
2. **Routing (`frontend/cosmos/src/App.tsx`)**: `App.tsx` sets up the `BrowserRouter` (React Router) with three main routes:
    - `/` -> `<Dashboard />`
    - `/map` -> `<Map />`
    - `/chat` -> `<Chat />`
3. **Global Socket (`frontend/cosmos/src/socket.ts`)**: This module is evaluated when imported. It retrieves the username from `localStorage` and initializes a `socket.io-client` instance with `autoConnect: true`.

## 3. Component Flows

### A. Dashboard (`<Dashboard />`)
- **Render**: Displays the main landing page UI.
- **Interaction**: Contains purely structural HTML/Tailwind and React Router `<Link>` components to navigate to the Map or Chat views. No socket interaction happens here.

### B. Chat Room (`<Chat />`)
1. **State Initialization**: Reads `chat-username` from `localStorage`. If missing, the component renders a "Join Screen".
2. **Join Flow**: User enters a name -> `handleJoin()` is called -> saves to `localStorage` -> updates state -> renders the "Chat Screen".
3. **Socket Connection (`useEffect`)**:
    - Updates the socket query with the username.
    - Registers listeners for `connect`, `disconnect`, `chat-history`, and `server-message`.
    - Explicitly emits `request-chat-history` to ensure the frontend has the latest state.
    - Calls `socket.connect()` if not already connected.
4. **Sending a Message (`handleSend`)**:
    - User types and hits Send/Enter.
    - The message is appended to local state immediately (optimistic UI update).
    - `socket.emit('user-message', { message })` is sent to the backend.
5. **Receiving a Message**:
    - Backend broadcasts `server-message`.
    - The `onServerMessage` listener catches it and appends it to the messages array, triggering a re-render.
    - A secondary `useEffect` triggers a smooth scroll to the bottom of the chat container.

### C. Map View (`<Map />`)
1. **Socket Connection (`useEffect`)**:
    - Ensures socket is connected with the current username and userId.
    - Registers listeners for `pins-history`, `pin-added`, `requests-history`, `request-created`, and `request-updated`.
    - Emits `request-pins-history` and `request-requests-history` to fetch the initial state of the map.
2. **Tile Rendering**:
    - The `react-leaflet` `<TileLayer />` component requests map tiles from the backend's static file server (`http://[hostname]:3001/tiles/{z}/{x}/{y}.png`).
3. **Dropping a Request (Replaces Legacy Pins)**:
    - The `<MapEventsHandler />` component hooks into Leaflet's `useMapEvents`.
    - User clicks on the map -> `click` event fires -> opens the `<RequestModal />` form.
    - User completes the form and submits -> emits `socket.emit('create-request', { ... })`.
4. **Receiving a Request**:
    - Backend processes the `create-request` event and broadcasts `request-created`.
    - The `request-created` listener catches it, updates the `requests` state array, and the map re-renders to place the new custom colored `<Marker />` and `<RequestCard />` popup.
    - Active requests are also aggregated and strictly sorted in the slide-over `<RequestListPanel />`.
    - Both map markers and list items are dynamically filtered by the global search bar and filter toggles (Priority, Category, Resource Type).

### D. Backend Background Jobs
1. **Time-Based Evaluation (`setInterval`)**:
    - The backend runs an evaluation loop every minute (`EVALUATION_INTERVAL_MS = 60000`).
    - **Expiry Check**: If `Date.now()` exceeds a request's `expiresAt`, its status mutates to `expired`.
    - **Auto-Escalation**: Unresolved requests (excluding `LOW` base priority) have their priority bumped by 1 after 60 minutes, and bumped by 2 after 120 minutes (capped at `CRITICAL`).
    - The server broadcasts `request-updated` events *only* for requests whose state mutated during the tick.

### E. Resource Aggregator
1. **Startup Loading**:
    - The backend synchronously parses `backend/data/resources.json` into a `resources` array upon startup.
2. **Client Interaction**:
    - The `<Map />` component emits `request-resources` on mount and listens for `resources-history` to populate the map.
    - Resources render as square `L.divIcon` markers, color-coded by their operational `status` (`OPEN`/`LIMITED`/`CLOSED`).
    - Users can click a resource to open `<ResourceCard />`, which displays service availability and verification data.
3. **Updating Status**:
    - Any user can click a status button in `<ResourceCard />` to verify the resource's current condition on the ground.
    - This emits `update-resource` with the new status, which mutates the resource in memory, sets `lastVerifiedAt` and `verifiedBy`, and immediately broadcasts `resource-updated` to all connected clients.

### F. Request/Resource Matching
1. **Frontend Distance Calculation**:
    - The frontend computes geographical distances between Requests and Resources using a completely local Haversine formula (`frontend/cosmos/src/utils.ts`), avoiding external routing API dependencies.
2. **Relevance Mapping**:
    - A static mapping links `RequestCategory` types to arrays of relevant `ResourceType` types (e.g. `medical -> ['HOSPITAL', 'CLINIC', 'PHARMACY']`).
3. **Nearby Help Panel**:
    - Inside `<RequestCard />`, the system automatically surfaces the top 3 best-matched infrastructural resources for `open` and `in_progress` requests.
    - Matches are scored and sorted locally based on operational Availability (`OPEN` > `LIMITED`), Relevance (Category mapping), Proximity (Haversine distance), and Verification Age.
4. **User Distance**:
    - If the user grants browser geolocation permissions, `<Map />` captures their coordinate position and passes it to `<ResourceCard />`, which dynamically renders the real-world distance between the user and the tapped resource.

### G. Chat Integration and Global Alerts
1. **Chat Attachments**:
    - Users can share `request` or `resource` objects directly to the chat stream.
    - The backend `ChatMessage` struct attaches a payload (e.g. `{ type: 'resource', id: 'uuid' }`).
    - The frontend Chat interface intercepts these attachments and renders structured `<RequestCard />` and `<ResourceCard />` inline, bypassing standard text bubbles.
2. **Dashboard & Quick Actions**:
    - The Dashboard subscribes directly to network history events to display live metrics (Online Users, Needs, Resources).
    - Quick Action buttons redirect the user to `/map?intent=[category]`. The map detects this parameter and provides a sticky banner instructing the user to drop a pin, at which point the `<RequestModal />` pre-populates with the intended category.
3. **Critical Alerts**:
    - The root `<App />` mounts an `<AlertBanner />` that listens globally to `request-created` and `request-updated` events.
    - If a Priority 1 (CRITICAL) request is detected, it slides down an alert banner and plays a synthesized HTML5 AudioContext beep, successfully notifying users of emergencies without requiring external Push Notification services.
