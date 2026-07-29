/**
 * COSMOS BLE Constants
 *
 * All UUIDs are 128-bit (string) format required by react-native-ble-plx.
 * These are custom UUIDs — NOT standard Bluetooth SIG UUIDs.
 *
 * Generate your own unique UUIDs for production:
 *   node -e "const {v4}=require('uuid'); console.log(v4())"
 *
 * OEM NOTE: Some Samsung/MIUI devices filter 128-bit custom UUIDs in
 * scan results unless the service UUID is included in the advertisement
 * payload explicitly. BluetoothLeAdvertiser.startAdvertising() on the
 * peripheral side includes the service UUID in AdvertiseData — this is
 * already handled in CosmosPeripheralModule.kt.
 */

// Primary GATT service hosted by the peripheral (COSMOS node)
export const COSMOS_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';

// Writable + readable + notifiable characteristic for message exchange
export const COSMOS_MESSAGE_CHARACTERISTIC_UUID = '12345678-1234-1234-1234-123456789def';

// Device name prefix used in BLE advertisement packets
// Kept short (≤8 chars) to fit in legacy 31-byte advertisement payload
// alongside the 16-byte service UUID + flags
export const COSMOS_DEVICE_NAME_PREFIX = 'COSMOS-';

// Scan timeout in milliseconds (15 s is aggressive; reduce to 10 s in Phase 2)
export const SCAN_TIMEOUT_MS = 15000;

// GATT connect timeout
export const CONNECT_TIMEOUT_MS = 10000;

// Maximum message payload bytes for a single GATT write (no-response write)
// BLE 4.x default MTU = 23 bytes, payload = 20 bytes
// BLE 5.0 negotiated MTU can reach 512 bytes; we negotiate on connect in Phase 2
// For Phase 0 spike: keep messages ≤ 20 bytes to guarantee delivery on all devices
export const MAX_MESSAGE_BYTES = 20;

// Auto-reply the peripheral sends back when it receives a write
export const PERIPHERAL_ACK_MESSAGE = 'ACK_OK';

// The test string the central sends during the spike
export const SPIKE_TEST_MESSAGE = 'HELLO COSMOS';
