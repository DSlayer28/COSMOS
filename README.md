# COSMOS — LAN Disaster Response Platform

COSMOS is a LAN-first, offline-capable disaster response coordination platform. It allows groups of people co-located on the same WiFi network or mobile hotspot to coordinate emergencies seamlessly without requiring an internet connection.

## 🚀 Key Features & Accessibility

- **Per-Visit Name Prompt**: Users are prompted for their display name on every visit/session.
- **Zero-Typing Access**: Connect instantly using:
  - **Local Domain (mDNS)**: Open `http://cosmos.local:3001` on any mobile or desktop browser.
  - **QR Code Scanning**: Scan the terminal QR code at server startup or the in-app Dashboard QR code with your mobile camera.
  - **PWA Home Screen Installation**: Tap "Install App" or "Add to Home Screen" to launch COSMOS as a native standalone app.
- **Real-Time Global Chat**: Share messages, resource cards, and request alerts across the network.
- **Interactive Offline Map**: Drop pins, view nearby help, filter categories, and track active needs.
- **Resource Aggregator**: Live tracking of local shelters, medical centers, and supply distribution hubs.

## 🛠️ Running the Project

COSMOS runs as a **single server** — the backend serves the built frontend on port `3001`. No separate frontend dev server needed.

### First-time / after UI changes

```bash
cd frontend/cosmos
npm install        # only needed once
npm run build      # builds React app and copies output → backend/public
```

### Every session (the only command you need)

```bash
cd backend
npm install        # only needed once
npm run dev        # compiles TS → starts server on :3001 with QR code
```

Open `http://localhost:3001` in your browser, or scan the terminal QR code with a phone.

### Actively developing the frontend?

Run this in a **second terminal** while the backend is running — it rebuilds on every save:

```bash
cd frontend/cosmos
npm run watch      # vite build --watch → auto-copies to backend/public
```

> The backend's `dev` script (`tsc && node dist/index.js`) recompiles and restarts when you run it again after backend changes.

## 📚 Documentation

- [`PROJECT.md`](./PROJECT.md) — Comprehensive technical overview, architecture, directory structure, data schemas, and API contracts.
- [`FLOW.md`](./FLOW.md) — End-to-end user interaction and system execution flows.
- [`decisions.md`](./decisions.md) — Architecture decision record (ADR) documenting design trade-offs and rationale.
