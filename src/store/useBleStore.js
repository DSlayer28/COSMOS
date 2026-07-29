/**
 * useBleStore.js — Zustand global state for BLE spike
 *
 * Keeps all BLE-related state in one place so both the UI and
 * service layer share a single source of truth.
 *
 * Architecture note: In Phase 2+ we'll split this into:
 *   - useBleStore (transport layer state)
 *   - useMessageStore (message queue + relay logic)
 *   - useNodeStore (mesh node registry)
 * For now, one flat store is sufficient.
 */

import { create } from 'zustand';

const MAX_LOG_LINES = 200; // prevent unbounded growth in the spike UI

const useBleStore = create((set, get) => ({
  // ─── Permission State ───────────────────────────────────────────────────
  permissionsGranted: false,
  setPermissionsGranted: (granted) => set({ permissionsGranted: granted }),

  // ─── Role ───────────────────────────────────────────────────────────────
  // 'central'    → scan + connect + write
  // 'peripheral' → advertise + GATT server
  // 'dual'       → both simultaneously (tested in Phase 0)
  role: 'central',
  setRole: (role) => set({ role }),

  // ─── Bluetooth Adapter State ────────────────────────────────────────────
  bluetoothReady: false,
  setBluetoothReady: (ready) => set({ bluetoothReady: ready }),

  // ─── Scanning (Central) ─────────────────────────────────────────────────
  isScanning: false,
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  discoveredDevices: [],
  addDiscoveredDevice: (device) =>
    set((state) => {
      // Deduplicate by device.id (BLE MAC / random address)
      const exists = state.discoveredDevices.some((d) => d.id === device.id);
      if (exists) return state;
      return { discoveredDevices: [...state.discoveredDevices, device] };
    }),
  clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

  // ─── Connection (Central) ───────────────────────────────────────────────
  connectedDevice: null,
  setConnectedDevice: (device) => set({ connectedDevice: device }),

  isConnecting: false,
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),

  // Active BLE subscriptions — stored here so we can clean up on disconnect
  notificationSubscription: null,
  connectionSubscription: null,
  setNotificationSubscription: (sub) => set({ notificationSubscription: sub }),
  setConnectionSubscription: (sub) => set({ connectionSubscription: sub }),

  // ─── Advertising (Peripheral) ───────────────────────────────────────────
  isAdvertising: false,
  setIsAdvertising: (advertising) => set({ isAdvertising: advertising }),

  connectedCentrals: [], // list of central device addresses connected to us as peripheral
  addConnectedCentral: (address) =>
    set((state) => ({
      connectedCentrals: state.connectedCentrals.includes(address)
        ? state.connectedCentrals
        : [...state.connectedCentrals, address],
    })),
  removeConnectedCentral: (address) =>
    set((state) => ({
      connectedCentrals: state.connectedCentrals.filter((a) => a !== address),
    })),

  // ─── Last received message ───────────────────────────────────────────────
  lastReceivedMessage: null,
  setLastReceivedMessage: (msg) => set({ lastReceivedMessage: msg }),

  // ─── Event Log (Spike UI) ────────────────────────────────────────────────
  log: [],
  appendLog: (entry) =>
    set((state) => {
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
      const line = `[${timestamp}] ${entry}`;
      const trimmed =
        state.log.length >= MAX_LOG_LINES
          ? state.log.slice(state.log.length - MAX_LOG_LINES + 1)
          : state.log;
      return { log: [...trimmed, line] };
    }),
  clearLog: () => set({ log: [] }),

  // ─── Full reset (used when tearing down BLE on unmount) ──────────────────
  reset: () =>
    set({
      isScanning: false,
      isAdvertising: false,
      discoveredDevices: [],
      connectedDevice: null,
      isConnecting: false,
      connectedCentrals: [],
      lastReceivedMessage: null,
    }),
}));

export default useBleStore;
