# COSMOS Phase 0 — Build & Test Instructions

This project uses custom native modules for BLE. It **cannot be run in Expo Go**. You must compile it to a native Android app.

## Prerequisites

1.  **Node.js** (v18+)
2.  **Java JDK 17** (`JAVA_HOME` environment variable must be set)
3.  **Android Studio** (specifically the Android SDK Platform 35 and Build Tools installed)
4.  **Two physical Android 12+ devices**. Emulators do *not* have Bluetooth hardware and will crash or fail instantly.

## Step 1: Prebuild the Native Folders

In the `COSMOS_PROJECT_APP` directory, run:

```bash
npx expo prebuild --platform android --clean
```
This generates the `/android` folder, links the `react-native-ble-plx` plugin, and registers the custom `cosmos-ble-peripheral` Kotlin module.

## Step 2: Build and Install

Connect Phone 1 via USB (ensure Developer Options and USB Debugging are enabled).
Run:

```bash
npx expo run:android --device
```

This will trigger a full Gradle build (this takes 2-5 minutes the first time). If it asks to start the Metro bundler, say yes.

Once installed on Phone 1, disconnect it, connect Phone 2 via USB, and repeat the command to install on the second device.

> **Tip for Windows Users**: If `run:android` fails to find your device, open the `android` folder in Android Studio and click the green "Run" button from there. Android Studio's device manager is often better at resolving ADB driver issues.

## Step 3: Run the Spike Test

1.  **Phone A (Peripheral):** Tap **Advertise Node**. Wait for the log to say "Peripheral started".
2.  **Phone B (Central):** Tap **Scan for Nodes**. You should see `COSMOS-XXXX` appear in the list.
3.  **Phone B:** Tap the **Connect** button next to the device.
4.  **Verification:**
    *   Both phones' event logs should say "Central connected / Connected to...".
5.  **Phone B:** Tap **Send "HELLO COSMOS"**.
6.  **Verification:**
    *   Phone A log: `Periph Rcvd: HELLO COSMOS from [MAC_ADDRESS]`
    *   Phone A instantly sends an auto-reply.
    *   Phone B log: `Cent Rcvd Notify: ACK_OK`

If this loop completes, the Phase 0 spike is 100% successful. You have proven bidirectional BLE communication over a custom GATT service on your hardware.

## Troubleshooting

- **"Bluetooth is not enabled"**: Turn on Bluetooth in quick settings.
- **"Permissions missing"**: You denied permissions. Go to Android Settings -> Apps -> COSMOS -> Permissions and enable Location and Nearby Devices (Bluetooth).
- **Scan finds nothing**: Check if Location Services (GPS) is turned off globally on the phone. Some Android 12 devices still require GPS to be active for BLE scanning to work, even with the new Bluetooth permissions.
- **Build fails with "CosmosPeripheralModule not found"**: You forgot to run `npx expo prebuild` or you are trying to run the app in Expo Go.
