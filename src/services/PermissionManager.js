/**
 * PermissionManager.js
 *
 * Handles all Bluetooth runtime permissions for Android 12+ (API 31+).
 *
 * Android 12 (API 31) introduced granular Bluetooth permissions replacing
 * the old BLUETOOTH + ACCESS_FINE_LOCATION model:
 *
 *   BLUETOOTH_SCAN     — required to scan for nearby BLE devices
 *   BLUETOOTH_CONNECT  — required to connect to / communicate with devices
 *   BLUETOOTH_ADVERTISE — required to advertise as a peripheral
 *
 * ACCESS_FINE_LOCATION is STILL required on API 31 for some OEMs (notably
 * Samsung One UI 4.x and some MIUI builds) even with neverForLocation flag.
 * We include it unconditionally to avoid silent scan failures.
 *
 * OEM RISK: On Xiaomi/POCO/Redmi with MIUI/HyperOS, granting permissions
 * here is NOT enough. The user must also enable:
 *   Settings → Apps → COSMOS → Battery → "No restrictions"
 *   Settings → Apps → COSMOS → App info → "Auto-start" (MIUI)
 * Without this, BLE scanning is silently killed in the background.
 * We show a one-time warning for these devices in Phase 1.
 */

import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

// Full set of permissions needed for central + peripheral dual-role on Android 12+
const ANDROID_12_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
];

/**
 * Request all BLE permissions required for dual-role (central + peripheral).
 *
 * @returns {Promise<{granted: boolean, results: Object}>}
 *   granted  — true only if ALL required permissions are granted
 *   results  — per-permission status map for diagnostic logging
 */
export async function requestBlePermissions() {
  if (Platform.OS !== 'android') {
    // iOS path — not needed for v1.0, left as stub
    return { granted: true, results: {} };
  }

  const apiLevel = Platform.Version;

  // Android < 12 (API < 31): legacy model, only location needed for scanning
  if (apiLevel < 31) {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'COSMOS needs Location access',
          message:
            'On Android 10/11, Bluetooth scanning requires Location permission. ' +
            'COSMOS never uses your GPS — this is an Android limitation.',
          buttonPositive: 'Grant',
          buttonNegative: 'Deny',
        }
      );
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      return {
        granted,
        results: { ACCESS_FINE_LOCATION: result },
      };
    } catch (e) {
      console.error('[PermissionManager] Legacy permission request failed:', e);
      return { granted: false, results: {} };
    }
  }

  // Android 12+ (API 31+): request all granular BLE permissions at once
  try {
    const results = await PermissionsAndroid.requestMultiple(ANDROID_12_PERMISSIONS);

    const allGranted = ANDROID_12_PERMISSIONS.every(
      (perm) => results[perm] === PermissionsAndroid.RESULTS.GRANTED
    );

    // Detect "never ask again" — requires user to go to settings manually
    const blocked = ANDROID_12_PERMISSIONS.filter(
      (perm) => results[perm] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    );

    if (blocked.length > 0) {
      // Surface a Settings redirect for blocked permissions
      showBlockedPermissionAlert(blocked);
    }

    return { granted: allGranted, results };
  } catch (e) {
    console.error('[PermissionManager] Android 12+ permission request failed:', e);
    return { granted: false, results: {} };
  }
}

/**
 * Check current permission status without requesting.
 * Used on app resume / foreground to re-validate.
 *
 * @returns {Promise<boolean>}
 */
export async function checkBlePermissions() {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 31) {
    return PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
  }
  const checks = await Promise.all(
    ANDROID_12_PERMISSIONS.map((p) => PermissionsAndroid.check(p))
  );
  return checks.every(Boolean);
}

/**
 * Show an alert when a permission is permanently blocked ("never ask again").
 * Guides user to the app settings page to manually re-enable.
 */
function showBlockedPermissionAlert(blockedPerms) {
  const permNames = blockedPerms
    .map((p) => p.split('.').pop()) // e.g. BLUETOOTH_SCAN
    .join(', ');

  Alert.alert(
    'Bluetooth Permissions Blocked',
    `COSMOS needs ${permNames} to work. These were permanently denied.\n\n` +
      'Please go to App Settings → Permissions → Bluetooth and enable all permissions.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => Linking.openSettings(),
      },
    ]
  );
}
