/**
 * BluetoothManager.js  — GATT Central role
 *
 * Wraps react-native-ble-plx to provide a clean async API for:
 *   - Scanning for COSMOS peripherals
 *   - Connecting and discovering GATT services/characteristics
 *   - Reading / writing the COSMOS_MESSAGE characteristic
 *   - Subscribing to NOTIFY for incoming messages
 *
 * ─── OEM / Chipset notes (test these on each device) ───────────────────────
 * 1. CONCURRENT CONNECTION LIMIT
 *    Qualcomm chipsets (most Snapdragon phones):  ~4 simultaneous GATT connections
 *    MediaTek chipsets (budget/mid-range):         ~7 simultaneous GATT connections
 *    Samsung Exynos:                               ~4 simultaneous GATT connections
 *    → Phase 0 tests only 1-to-1. Phase 2 relay must track active conn count.
 *
 * 2. SCAN RESULT FILTERING
 *    Some Samsung One UI 4+ and MIUI devices return EMPTY scan results if
 *    BLUETOOTH_SCAN is granted but ACCESS_FINE_LOCATION is denied or Location
 *    Services (GPS toggle) is off — even with neverForLocation flag on the
 *    permission. Always verify Location Services is ON during testing.
 *
 * 3. BLE ADDRESS RANDOMIZATION
 *    Android 10+ randomizes BLE MAC addresses per session. Never persist
 *    `device.id` (which IS the MAC) across app restarts for identification.
 *    In Phase 2, we'll use a stable node ID in the advertisement data instead.
 *
 * 4. MTU NEGOTIATION
 *    Default BLE MTU = 23 bytes (payload = 20 bytes). We keep Phase 0 messages
 *    ≤ 20 bytes. In Phase 2, call device.requestMTU(512) after connect to
 *    support larger relay payloads on BLE 5.0 devices.
 *
 * 5. SAMSUNG BACKGROUND SCAN THROTTLE
 *    Samsung Android 11+ throttles BLE scans to 15s/5min when app is in
 *    background. Phase 0 keeps app foregrounded. Phase 1 needs a ForegroundService.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { BleManager, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import {
  COSMOS_SERVICE_UUID,
  COSMOS_MESSAGE_CHARACTERISTIC_UUID,
  SCAN_TIMEOUT_MS,
  CONNECT_TIMEOUT_MS,
} from '../constants/ble';

// Singleton BleManager — only ONE instance per app lifetime (BLE spec requirement)
let _manager = null;

function getManager() {
  if (!_manager) {
    _manager = new BleManager();
  }
  return _manager;
}

/**
 * Wait for Bluetooth adapter to be in PoweredOn state.
 * Resolves immediately if already on, rejects after 10 s if still off.
 *
 * @returns {Promise<void>}
 */
export function waitForBluetoothReady() {
  return new Promise((resolve, reject) => {
    const manager = getManager();
    const timeout = setTimeout(
      () => reject(new Error('Bluetooth did not power on within 10 s')),
      10000
    );
    const sub = manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        clearTimeout(timeout);
        sub.remove();
        resolve();
      } else if (state === State.PoweredOff || state === State.Unauthorized) {
        clearTimeout(timeout);
        sub.remove();
        reject(new Error(`Bluetooth state: ${state}`));
      }
    }, true); // `true` = emit current state immediately
  });
}

/**
 * Start scanning for COSMOS peripherals (devices advertising COSMOS_SERVICE_UUID).
 *
 * @param {function} onDeviceFound  Called each time a new device is found: (device) => void
 * @param {function} onError        Called on scan error: (error) => void
 * @returns {function} stopScan     Call this to stop scanning manually
 */
export function startScan(onDeviceFound, onError) {
  const manager = getManager();
  const seenIds = new Set();

  // Scan specifically for devices advertising our service UUID.
  // Passing null instead of [COSMOS_SERVICE_UUID] scans ALL devices —
  // useful during Phase 0 debugging if your peripheral isn't showing up.
  // Switch to [COSMOS_SERVICE_UUID] for production to reduce battery drain.
  manager.startDeviceScan(
    [COSMOS_SERVICE_UUID], // filter by service UUID
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        console.error('[BluetoothManager] Scan error:', error);
        onError?.(error);
        return;
      }
      if (device && !seenIds.has(device.id)) {
        seenIds.add(device.id);
        onDeviceFound(device);
      }
    }
  );

  // Auto-stop after SCAN_TIMEOUT_MS to preserve battery
  const timeoutId = setTimeout(() => {
    manager.stopDeviceScan();
    console.log('[BluetoothManager] Scan timed out after', SCAN_TIMEOUT_MS, 'ms');
  }, SCAN_TIMEOUT_MS);

  return () => {
    clearTimeout(timeoutId);
    manager.stopDeviceScan();
  };
}

/**
 * Stop any active scan immediately.
 */
export function stopScan() {
  getManager().stopDeviceScan();
}

/**
 * Connect to a device and discover services + characteristics.
 * Returns the connected Device object with services/characteristics populated.
 *
 * OEM NOTE: Some MediaTek devices require a 500 ms delay between connect()
 * and discoverAllServicesAndCharacteristics() or they return empty service lists.
 * The delay is baked in below via connectWithServices().
 *
 * @param {Device} device  The device object from scan
 * @returns {Promise<Device>}
 */
export async function connectToDevice(device) {
  const manager = getManager();

  console.log('[BluetoothManager] Connecting to', device.name || device.id);

  // connectWithServices() = connect() + discoverAllServicesAndCharacteristics()
  // in one call with a built-in timeout
  const connected = await manager.connectToDevice(device.id, {
    timeout: CONNECT_TIMEOUT_MS,
    autoConnect: false, // true causes issues on Pixel/Samsung on first connect
  });

  // Small delay for MediaTek chipset compatibility
  await new Promise((r) => setTimeout(r, 300));

  await connected.discoverAllServicesAndCharacteristics();

  console.log('[BluetoothManager] Connected and discovered services on', connected.id);
  return connected;
}

/**
 * Disconnect from a connected device.
 *
 * @param {string} deviceId
 */
export async function disconnectDevice(deviceId) {
  try {
    await getManager().cancelDeviceConnection(deviceId);
    console.log('[BluetoothManager] Disconnected from', deviceId);
  } catch (e) {
    // Already disconnected — safe to ignore
    console.warn('[BluetoothManager] Disconnect error (may be already disconnected):', e.message);
  }
}

/**
 * Write a UTF-8 string to the COSMOS_MESSAGE characteristic on the connected device.
 * Uses writeWithResponse (Write Request) so we get a confirmation from the peripheral.
 *
 * @param {Device} device   Connected & discovered device
 * @param {string} message  UTF-8 string to send (max 20 chars for Phase 0)
 * @returns {Promise<Characteristic>}
 */
export async function sendMessage(device, message) {
  const encoded = Buffer.from(message, 'utf-8').toString('base64');
  console.log('[BluetoothManager] Writing:', message, '→', encoded);
  return device.writeCharacteristicWithResponseForService(
    COSMOS_SERVICE_UUID,
    COSMOS_MESSAGE_CHARACTERISTIC_UUID,
    encoded
  );
}

/**
 * Subscribe to NOTIFY on the COSMOS_MESSAGE characteristic.
 * The peripheral sends notifications when it has data for us (e.g., ACK_OK).
 *
 * @param {Device}   device    Connected & discovered device
 * @param {function} onMessage Called with (string) on each notification
 * @returns {Subscription}     Call .remove() to unsubscribe
 */
export function listenForMessages(device, onMessage) {
  return device.monitorCharacteristicForService(
    COSMOS_SERVICE_UUID,
    COSMOS_MESSAGE_CHARACTERISTIC_UUID,
    (error, characteristic) => {
      if (error) {
        console.warn('[BluetoothManager] Notification error:', error.message);
        return;
      }
      if (characteristic?.value) {
        const decoded = Buffer.from(characteristic.value, 'base64').toString('utf-8');
        console.log('[BluetoothManager] Received notification:', decoded);
        onMessage(decoded);
      }
    }
  );
}

/**
 * Monitor device connection state changes.
 * Use this to detect unexpected disconnects.
 *
 * @param {string}   deviceId
 * @param {function} onDisconnect  Called with (deviceId) when disconnected
 * @returns {Subscription}
 */
export function monitorConnection(deviceId, onDisconnect) {
  return getManager().onDeviceDisconnected(deviceId, (error, device) => {
    console.log('[BluetoothManager] Device disconnected:', deviceId, error?.message);
    onDisconnect?.(deviceId);
  });
}

/**
 * Destroy the BleManager singleton.
 * Call this in the root component's cleanup / on app unmount.
 */
export function destroyBleManager() {
  if (_manager) {
    _manager.destroy();
    _manager = null;
  }
}
