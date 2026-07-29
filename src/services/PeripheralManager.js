/**
 * PeripheralManager.js
 *
 * Wrapper around the custom cosmos-ble-peripheral native module.
 * Exposes methods to start/stop the GATT server and listen to events.
 * Updates the global Zustand store (useBleStore) with connection state.
 */

import { Platform } from 'react-native';
import useBleStore from '../store/useBleStore';

// We import carefully to avoid crashes on iOS if we were ever to run there
let peripheralModule = null;
if (Platform.OS === 'android') {
  peripheralModule = require('../../modules/cosmos-ble-peripheral');
}

let subscriptions = [];

/**
 * Start advertising as a BLE peripheral and open the GATT server.
 * Subscribes to native events to update global state and UI.
 *
 * @param {string} deviceName - Short name to broadcast (will be truncated to 8 chars by native code)
 * @returns {Promise<void>}
 */
export async function startPeripheralMode(deviceName) {
  if (!peripheralModule) {
    console.warn('[PeripheralManager] Peripheral mode is Android only');
    return;
  }

  const {
    startPeripheral,
    peripheralEmitter,
    CosmosPeripheralEvents,
  } = peripheralModule;
  const store = useBleStore.getState();

  try {
    // 1. Setup native event listeners
    setupPeripheralListeners(peripheralEmitter, CosmosPeripheralEvents);

    // 2. Start native advertising / GATT server
    await startPeripheral(deviceName);

    console.log('[PeripheralManager] Peripheral started, advertising as:', deviceName);
    store.appendLog(`Peripheral started: ${deviceName}`);
    store.setIsAdvertising(true);
  } catch (error) {
    console.error('[PeripheralManager] Failed to start peripheral:', error);
    store.appendLog(`Peripheral start failed: ${error.message}`);
    store.setIsAdvertising(false);
    throw error;
  }
}

/**
 * Stop advertising, close GATT server, and remove event listeners.
 */
export async function stopPeripheralMode() {
  if (!peripheralModule) return;

  const { stopPeripheral } = peripheralModule;
  const store = useBleStore.getState();

  try {
    await stopPeripheral();
    store.setIsAdvertising(false);
    store.appendLog('Peripheral stopped');
  } catch (error) {
    console.error('[PeripheralManager] Stop error:', error);
  } finally {
    clearPeripheralListeners();
  }
}

/**
 * Send a notification (message push) from this peripheral to all connected centrals.
 * In Phase 0, this is just the "ACK_OK" response (handled auto by native), but
 * this method is here to test manual pushes if needed.
 *
 * @param {string} message
 */
export async function sendNotificationToCentrals(message) {
  if (!peripheralModule) return;
  try {
    await peripheralModule.sendNotification(message);
    const store = useBleStore.getState();
    store.appendLog(`Peripheral Sent Notify: ${message}`);
  } catch (error) {
    console.error('[PeripheralManager] Send Notify error:', error);
  }
}

// ─── Internal Event Handlers ────────────────────────────────────────────────

function setupPeripheralListeners(emitter, events) {
  // Clear any old ones just in case
  clearPeripheralListeners();
  if (!emitter) return;

  const store = useBleStore.getState();

  subscriptions.push(
    emitter.addListener(events.ON_CENTRAL_CONNECTED, (event) => {
      console.log('[PeripheralManager] Central Connected:', event.address);
      store.addConnectedCentral(event.address);
      store.appendLog(`Central connected: ${event.address}`);
    })
  );

  subscriptions.push(
    emitter.addListener(events.ON_CENTRAL_DISCONNECTED, (event) => {
      console.log('[PeripheralManager] Central Disconnected:', event.address);
      store.removeConnectedCentral(event.address);
      store.appendLog(`Central disconnected: ${event.address}`);
    })
  );

  subscriptions.push(
    emitter.addListener(events.ON_MESSAGE_RECEIVED, (event) => {
      console.log('[PeripheralManager] Received Write:', event.message);
      store.setLastReceivedMessage(event.message);
      store.appendLog(`Periph Rcvd: ${event.message} from ${event.address}`);
    })
  );

  subscriptions.push(
    emitter.addListener(events.ON_ERROR, (event) => {
      console.error('[PeripheralManager] Native Error:', event.error);
      store.appendLog(`Periph Error: ${event.error}`);
      store.setIsAdvertising(false); // Assume crash/stop on error
    })
  );

  // Advertising start/stop are also handled by promise resolution,
  // but events provide backup state syncing if native code stops unexpectedly
  subscriptions.push(
    emitter.addListener(events.ON_ADVERTISING_STARTED, () => {
      store.setIsAdvertising(true);
    })
  );

  subscriptions.push(
    emitter.addListener(events.ON_ADVERTISING_STOPPED, () => {
      store.setIsAdvertising(false);
    })
  );
}

function clearPeripheralListeners() {
  subscriptions.forEach((sub) => {
    if (sub && typeof sub.remove === 'function') {
      sub.remove();
    }
  });
  subscriptions = [];
}
