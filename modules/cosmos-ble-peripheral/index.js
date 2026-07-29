/**
 * cosmos-ble-peripheral — JS bridge
 *
 * Wraps the CosmosPeripheralModule native module (Kotlin) with a clean
 * promise-based + event-emitter API for use in PeripheralManager.js.
 *
 * This file uses NativeModules (Old Architecture), which works because
 * newArchEnabled is false in app.json for Phase 0.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const LINKING_ERROR =
  'CosmosPeripheralModule native module is not linked. ' +
  'Did you run `npx expo prebuild` and rebuild the app? ' +
  'This module does NOT work in Expo Go.';

// Throw a clear error if the native module is missing (e.g. running in Expo Go)
const NativePeripheral = NativeModules.CosmosPeripheralModule
  ? NativeModules.CosmosPeripheralModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export const CosmosPeripheralEvents = {
  ON_CENTRAL_CONNECTED:    'CosmosPeripheral.onCentralConnected',
  ON_CENTRAL_DISCONNECTED: 'CosmosPeripheral.onCentralDisconnected',
  ON_MESSAGE_RECEIVED:     'CosmosPeripheral.onMessageReceived',
  ON_ADVERTISING_STARTED:  'CosmosPeripheral.onAdvertisingStarted',
  ON_ADVERTISING_STOPPED:  'CosmosPeripheral.onAdvertisingStopped',
  ON_ERROR:                'CosmosPeripheral.onError',
};

// NativeEventEmitter for subscribing to native events from the GATT server
export const peripheralEmitter =
  Platform.OS === 'android' ? new NativeEventEmitter(NativePeripheral) : null;

/**
 * Start advertising + open GATT server.
 * @param {string} deviceName — will be truncated to 8 chars by the native layer
 * @returns {Promise<string>}
 */
export function startPeripheral(deviceName) {
  return NativePeripheral.startPeripheral(deviceName);
}

/**
 * Stop advertising and close GATT server.
 * @returns {Promise<string>}
 */
export function stopPeripheral() {
  return NativePeripheral.stopPeripheral();
}

/**
 * Send a NOTIFY to all currently connected centrals.
 * @param {string} message
 * @returns {Promise<string>}
 */
export function sendNotification(message) {
  return NativePeripheral.sendNotification(message);
}
