package com.cosmos.peripheral

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.Build
import android.os.ParcelUuid
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID

/**
 * CosmosPeripheralModule — GATT Peripheral + BLE Advertiser
 *
 * Exposes the following methods to JavaScript:
 *   startPeripheral(deviceName: String, promise)
 *   stopPeripheral(promise)
 *   sendNotification(message: String, promise)
 *
 * Emits the following events to JavaScript:
 *   CosmosPeripheral.onCentralConnected    { address: String }
 *   CosmosPeripheral.onCentralDisconnected { address: String }
 *   CosmosPeripheral.onMessageReceived     { message: String, address: String }
 *   CosmosPeripheral.onAdvertisingStarted  {}
 *   CosmosPeripheral.onAdvertisingStopped  {}
 *   CosmosPeripheral.onError               { error: String }
 *
 * ─── OEM / Hardware Notes ───────────────────────────────────────────────────
 * • PERIPHERAL MODE SUPPORT: Call BluetoothAdapter.isMultipleAdvertisementSupported()
 *   before startPeripheral(). Devices that return false cannot advertise.
 *   Known unsupported: some pre-2019 budget SoCs (MT6737, SC9832).
 *   We check and surface this to JS via onError.
 *
 * • GATT SERVER CALLBACK THREAD: All BluetoothGattServerCallback methods fire on
 *   the Binder thread, NOT the main thread. We use Handler(mainLooper) for
 *   any UI-related work and post events via sendEvent() which is thread-safe.
 *
 * • CONCURRENT CENTRAL CONNECTIONS: Android GATT server can handle multiple
 *   centrals connecting simultaneously. We track them in connectedCentrals.
 *   Qualcomm chipsets: stable up to ~4. MediaTek: ~7. Test Phase 0 with 1.
 *
 * • NOTIFICATION vs INDICATION: We use NOTIFY (no ACK from central). For
 *   reliable delivery in Phase 2 relay, switch to INDICATE (property 0x20)
 *   which requires a confirmation from the central before the next packet.
 *
 * • ADVERTISEMENT PAYLOAD SIZE: Legacy BLE advertising = 31 bytes max.
 *   Service UUID (16 bytes) + flags (3 bytes) + device name leaves ~8 chars
 *   for the name. We truncate device name to 8 chars.
 *   Android API 33+ supports extended advertising (254-byte payload).
 * ────────────────────────────────────────────────────────────────────────────
 */
class CosmosPeripheralModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        // Must match src/constants/ble.js exactly
        private const val SERVICE_UUID_STR       = "12345678-1234-1234-1234-123456789abc"
        private const val CHARACTERISTIC_UUID_STR = "12345678-1234-1234-1234-123456789def"

        // Event names (prefix avoids collision with other native modules)
        const val EVENT_CENTRAL_CONNECTED    = "CosmosPeripheral.onCentralConnected"
        const val EVENT_CENTRAL_DISCONNECTED = "CosmosPeripheral.onCentralDisconnected"
        const val EVENT_MESSAGE_RECEIVED     = "CosmosPeripheral.onMessageReceived"
        const val EVENT_ADVERTISING_STARTED  = "CosmosPeripheral.onAdvertisingStarted"
        const val EVENT_ADVERTISING_STOPPED  = "CosmosPeripheral.onAdvertisingStopped"
        const val EVENT_ERROR                = "CosmosPeripheral.onError"

        // Auto-reply sent back to the central on every received write
        private const val ACK_MESSAGE = "ACK_OK"
    }

    override fun getName(): String = "CosmosPeripheralModule"

    private val serviceUUID       = UUID.fromString(SERVICE_UUID_STR)
    private val characteristicUUID = UUID.fromString(CHARACTERISTIC_UUID_STR)

    private val bluetoothManager by lazy {
        reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    }
    private val bluetoothAdapter get() = bluetoothManager.adapter

    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var advertiseCallback: AdvertiseCallback? = null
    private val connectedCentrals = mutableSetOf<BluetoothDevice>()

    // ─── GATT Server Callback ──────────────────────────────────────────────

    private val gattServerCallback = object : BluetoothGattServerCallback() {

        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    connectedCentrals.add(device)
                    sendEvent(EVENT_CENTRAL_CONNECTED, Arguments.createMap().apply {
                        putString("address", device.address)
                        putString("name", device.name ?: "Unknown")
                    })
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    connectedCentrals.remove(device)
                    sendEvent(EVENT_CENTRAL_DISCONNECTED, Arguments.createMap().apply {
                        putString("address", device.address)
                    })
                }
            }
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray
        ) {
            // Decode the incoming UTF-8 message
            val message = String(value, Charsets.UTF_8)

            // Send success response back to central (required for Write With Response)
            if (responseNeeded) {
                gattServer?.sendResponse(
                    device,
                    requestId,
                    BluetoothGatt.GATT_SUCCESS,
                    0,
                    value
                )
            }

            // Emit message received event to JS
            sendEvent(EVENT_MESSAGE_RECEIVED, Arguments.createMap().apply {
                putString("message", message)
                putString("address", device.address)
            })

            // Auto-reply with ACK_OK via NOTIFY to the writing central
            sendNotifyToDevice(device, ACK_MESSAGE)
        }

        override fun onCharacteristicReadRequest(
            device: BluetoothDevice,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic
        ) {
            // Respond with current characteristic value
            gattServer?.sendResponse(
                device,
                requestId,
                BluetoothGatt.GATT_SUCCESS,
                offset,
                characteristic.value ?: "COSMOS_READY".toByteArray(Charsets.UTF_8)
            )
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            descriptor: BluetoothGattDescriptor,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray
        ) {
            // Central is enabling/disabling NOTIFY via the CCCD descriptor
            if (responseNeeded) {
                gattServer?.sendResponse(
                    device, requestId, BluetoothGatt.GATT_SUCCESS, 0, value
                )
            }
        }

        override fun onServiceAdded(status: Int, service: BluetoothGattService) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                // Service registered — now start advertising
                startAdvertising()
            } else {
                sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                    putString("error", "Failed to add GATT service, status=$status")
                })
            }
        }
    }

    // ─── Advertise Callback ────────────────────────────────────────────────

    private fun makeAdvertiseCallback(): AdvertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
            sendEvent(EVENT_ADVERTISING_STARTED, Arguments.createMap())
        }

        override fun onStartFailure(errorCode: Int) {
            val reason = when (errorCode) {
                ADVERTISE_FAILED_DATA_TOO_LARGE        -> "Data too large"
                ADVERTISE_FAILED_TOO_MANY_ADVERTISERS  -> "Too many advertisers"
                ADVERTISE_FAILED_ALREADY_STARTED       -> "Already started"
                ADVERTISE_FAILED_INTERNAL_ERROR        -> "Internal error"
                ADVERTISE_FAILED_FEATURE_UNSUPPORTED   -> "Feature unsupported on this chipset"
                else                                   -> "Unknown error $errorCode"
            }
            sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                putString("error", "Advertising failed: $reason")
            })
        }
    }

    // ─── React Methods ─────────────────────────────────────────────────────

    @ReactMethod
    fun startPeripheral(deviceName: String, promise: Promise) {
        try {
            // Check hardware support
            if (!bluetoothAdapter.isEnabled) {
                promise.reject("BT_OFF", "Bluetooth is not enabled")
                return
            }
            if (!bluetoothAdapter.isMultipleAdvertisementSupported) {
                promise.reject(
                    "NO_PERIPHERAL",
                    "This device chipset does not support BLE peripheral/advertiser mode. " +
                    "Known affected: pre-2019 budget SoCs (MT6737, SC9832, etc.)."
                )
                return
            }

            // Set device name (truncated to 8 chars to fit advertisement payload)
            val safeName = deviceName.take(8)
            bluetoothAdapter.name = safeName

            // Open GATT server
            gattServer = bluetoothManager.openGattServer(reactContext, gattServerCallback)
                ?: run {
                    promise.reject("GATT_FAIL", "Failed to open GATT server")
                    return
                }

            // Build GATT service with one READ|WRITE|NOTIFY characteristic
            val service = BluetoothGattService(serviceUUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)

            val characteristic = BluetoothGattCharacteristic(
                characteristicUUID,
                BluetoothGattCharacteristic.PROPERTY_READ or
                BluetoothGattCharacteristic.PROPERTY_WRITE or
                BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ or
                BluetoothGattCharacteristic.PERMISSION_WRITE
            )

            // Client Characteristic Configuration Descriptor (CCCD) — required for NOTIFY
            val cccd = BluetoothGattDescriptor(
                UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"),
                BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
            )
            characteristic.addDescriptor(cccd)
            service.addCharacteristic(characteristic)

            // addService triggers onServiceAdded callback which then starts advertising
            gattServer?.addService(service)

            promise.resolve("Peripheral starting...")
        } catch (e: Exception) {
            promise.reject("PERIPHERAL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopPeripheral(promise: Promise) {
        try {
            advertiser?.stopAdvertising(advertiseCallback)
            advertiseCallback = null
            advertiser = null
            gattServer?.close()
            gattServer = null
            connectedCentrals.clear()
            sendEvent(EVENT_ADVERTISING_STOPPED, Arguments.createMap())
            promise.resolve("Peripheral stopped")
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    /**
     * Send a NOTIFY to all connected centrals.
     * Called from JS to push data to scanning/connected central devices.
     */
    @ReactMethod
    fun sendNotification(message: String, promise: Promise) {
        try {
            if (connectedCentrals.isEmpty()) {
                promise.reject("NO_CENTRALS", "No centrals connected")
                return
            }
            val bytes = message.toByteArray(Charsets.UTF_8)
            connectedCentrals.forEach { device -> sendNotifyToDevice(device, message) }
            promise.resolve("Notification sent to ${connectedCentrals.size} central(s)")
        } catch (e: Exception) {
            promise.reject("NOTIFY_ERROR", e.message, e)
        }
    }

    // ─── Private Helpers ───────────────────────────────────────────────────

    private fun startAdvertising() {
        advertiser = bluetoothAdapter.bluetoothLeAdvertiser ?: run {
            sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                putString("error", "BluetoothLeAdvertiser not available")
            })
            return
        }

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0) // 0 = advertise indefinitely
            .build()

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(true)         // device name in the packet
            .setIncludeTxPowerLevel(false)      // save payload space
            .addServiceUuid(ParcelUuid(serviceUUID)) // service UUID for central filtering
            .build()

        val cb = makeAdvertiseCallback()
        advertiseCallback = cb
        advertiser?.startAdvertising(settings, data, cb)
    }

    private fun sendNotifyToDevice(device: BluetoothDevice, message: String) {
        val server = gattServer ?: return
        val service = server.getService(serviceUUID) ?: return
        val characteristic = service.getCharacteristic(characteristicUUID) ?: return

        characteristic.value = message.toByteArray(Charsets.UTF_8)
        // false = NOTIFY (no confirmation), true = INDICATE (with confirmation)
        server.notifyCharacteristicChanged(device, characteristic, false)
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    // Required for addListener/removeListeners to suppress yellow-box warnings
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
