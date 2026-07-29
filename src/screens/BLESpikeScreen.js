import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import useBleStore from '../store/useBleStore';
import { requestBlePermissions } from '../services/PermissionManager';
import {
  startScan,
  stopScan,
  connectToDevice,
  disconnectDevice,
  sendMessage,
  listenForMessages,
  monitorConnection,
  waitForBluetoothReady,
  destroyBleManager,
} from '../services/BluetoothManager';
import { startPeripheralMode, stopPeripheralMode } from '../services/PeripheralManager';
import DeviceCard from '../components/DeviceCard';
import { SPIKE_TEST_MESSAGE } from '../constants/ble';

export default function BLESpikeScreen() {
  const store = useBleStore();
  const [loading, setLoading] = useState('Initializing BLE...');
  const scrollRef = useRef(null);

  // ─── Initialization ────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      store.appendLog('App started. Requesting permissions...');
      const { granted } = await requestBlePermissions();

      if (!granted) {
        store.appendLog('ERROR: Permissions denied.');
        setLoading('Permissions missing. Cannot use BLE.');
        return;
      }
      store.setPermissionsGranted(true);
      store.appendLog('Permissions granted.');

      try {
        store.appendLog('Waiting for Bluetooth to power on...');
        await waitForBluetoothReady();
        store.setBluetoothReady(true);
        store.appendLog('Bluetooth is Ready.');
        setLoading(null);
      } catch (e) {
        store.appendLog(`BT Init Error: ${e.message}`);
        setLoading(`Bluetooth error: ${e.message}`);
      }
    }
    init();

    // Cleanup on unmount
    return () => {
      stopScan();
      stopPeripheralMode();
      destroyBleManager();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Central Actions ───────────────────────────────────────────────────────
  const handleScan = () => {
    if (store.isScanning) {
      stopScan();
      store.setIsScanning(false);
      store.appendLog('Scan stopped manually.');
      return;
    }

    store.clearDiscoveredDevices();
    store.setIsScanning(true);
    store.appendLog('Scanning for COSMOS nodes...');

    const stopFn = startScan(
      (device) => {
        store.addDiscoveredDevice(device);
        store.appendLog(`Found: ${device.name || device.id}`);
      },
      (error) => {
        store.appendLog(`Scan error: ${error.message}`);
        store.setIsScanning(false);
      }
    );

    // Auto-reset scan state after timeout (from constant)
    setTimeout(() => {
      store.setIsScanning(false);
    }, 15000);
  };

  const handleConnect = async (device) => {
    stopScan();
    store.setIsScanning(false);
    store.setIsConnecting(true);
    store.appendLog(`Connecting to ${device.id}...`);

    try {
      const connectedDevice = await connectToDevice(device);
      store.setConnectedDevice(connectedDevice);
      store.appendLog(`Connected to ${connectedDevice.id}.`);

      // Subscribe to NOTIFY so we can receive the ACK from the peripheral
      const sub = listenForMessages(connectedDevice, (msg) => {
        store.appendLog(`Cent Rcvd Notify: ${msg}`);
      });
      store.setNotificationSubscription(sub);

      // Monitor for unexpected disconnects
      const connSub = monitorConnection(connectedDevice.id, () => {
        handleDisconnect(true);
      });
      store.setConnectionSubscription(connSub);
    } catch (error) {
      store.appendLog(`Connect failed: ${error.message}`);
      Alert.alert('Connection Failed', error.message);
    } finally {
      store.setIsConnecting(false);
    }
  };

  const handleDisconnect = async (wasUnexpected = false) => {
    if (store.connectedDevice) {
      if (!wasUnexpected) {
        store.appendLog(`Disconnecting from ${store.connectedDevice.id}...`);
        await disconnectDevice(store.connectedDevice.id);
      }
      store.appendLog('Disconnected.');
    }

    // Cleanup subscriptions
    if (store.notificationSubscription) store.notificationSubscription.remove();
    if (store.connectionSubscription) store.connectionSubscription.remove();

    store.setNotificationSubscription(null);
    store.setConnectionSubscription(null);
    store.setConnectedDevice(null);
  };

  const handleSendTestMessage = async () => {
    if (!store.connectedDevice) return;
    try {
      store.appendLog(`Sending: "${SPIKE_TEST_MESSAGE}"`);
      await sendMessage(store.connectedDevice, SPIKE_TEST_MESSAGE);
      store.appendLog('Send OK. Waiting for ACK...');
    } catch (e) {
      store.appendLog(`Send failed: ${e.message}`);
    }
  };

  // ─── Peripheral Actions ────────────────────────────────────────────────────
  const handleToggleAdvertise = async () => {
    if (store.isAdvertising) {
      store.appendLog('Stopping peripheral mode...');
      await stopPeripheralMode();
    } else {
      store.appendLog('Starting peripheral mode...');
      try {
        // Generate a random 4-digit ID for this node
        const randId = Math.floor(1000 + Math.random() * 9000);
        await startPeripheralMode(`COSMOS-${randId}`);
      } catch (e) {
        // The error is already logged in PeripheralManager
        Alert.alert('Peripheral Error', e.message);
      }
    }
  };

  // ─── Render Helpers ────────────────────────────────────────────────────────
  const renderLog = () => (
    <ScrollView
      ref={scrollRef}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      className="bg-black p-3 rounded-lg border border-gray-800 h-64 mb-4"
    >
      {store.log.length === 0 ? (
        <Text className="text-gray-600 italic">No events yet...</Text>
      ) : (
        store.log.map((line, idx) => (
          <Text key={idx} className="text-green-400 font-mono text-xs mb-1">
            {line}
          </Text>
        ))
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-[#0D1117] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#3b82f6" className="mb-4" />
        <Text className="text-white text-lg text-center">{loading}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0D1117]">
      <View className="p-4 flex-1">
        <View className="mb-6">
          <Text className="text-3xl font-bold text-white mb-2">COSMOS</Text>
          <Text className="text-blue-400 font-semibold mb-1">Phase 0 BLE Spike</Text>
          <Text className="text-gray-400 text-xs">
            Role: Dual (Central + Peripheral)
          </Text>
        </View>

        {/* ─── Control Panel ─── */}
        <View className="flex-row justify-between mb-6 space-x-2">
          {/* Central Control */}
          {!store.connectedDevice ? (
            <TouchableOpacity
              onPress={handleScan}
              className={`flex-1 p-4 rounded-lg items-center ${
                store.isScanning ? 'bg-red-900/50 border border-red-500' : 'bg-blue-600'
              }`}
            >
              <Text className="text-white font-bold">
                {store.isScanning ? 'Stop Scan' : 'Scan for Nodes'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => handleDisconnect(false)}
              className="flex-1 bg-red-600 p-4 rounded-lg items-center"
            >
              <Text className="text-white font-bold">Disconnect</Text>
            </TouchableOpacity>
          )}

          {/* Peripheral Control */}
          <TouchableOpacity
            onPress={handleToggleAdvertise}
            className={`flex-1 p-4 rounded-lg items-center ${
              store.isAdvertising ? 'bg-green-600' : 'bg-gray-700'
            }`}
          >
            <Text className="text-white font-bold">
              {store.isAdvertising ? 'Stop Adv' : 'Advertise Node'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Discovered Devices / Active Connection ─── */}
        <View className="flex-1 mb-4">
          {store.connectedDevice ? (
            <View className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/50">
              <Text className="text-white font-bold text-lg mb-1">
                Connected to Central
              </Text>
              <Text className="text-blue-300 text-sm mb-4">
                ID: {store.connectedDevice.id}
              </Text>
              <TouchableOpacity
                onPress={handleSendTestMessage}
                className="bg-blue-500 p-3 rounded items-center"
              >
                <Text className="text-white font-bold">Send "{SPIKE_TEST_MESSAGE}"</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text className="text-gray-400 mb-2 uppercase text-xs font-bold tracking-wider">
                Discovered Nodes ({store.discoveredDevices.length})
              </Text>
              <ScrollView>
                {store.discoveredDevices.map((d) => (
                  <DeviceCard
                    key={d.id}
                    device={d}
                    onPress={handleConnect}
                    isConnecting={store.isConnecting}
                  />
                ))}
                {store.discoveredDevices.length === 0 && !store.isScanning && (
                  <Text className="text-gray-600 italic mt-4 text-center">
                    Press Scan to find nearby COSMOS nodes.
                  </Text>
                )}
                {store.isScanning && (
                  <ActivityIndicator color="#3b82f6" className="mt-8" />
                )}
              </ScrollView>
            </>
          )}
        </View>

        {/* ─── Event Log ─── */}
        <View>
          <View className="flex-row justify-between items-end mb-2">
            <Text className="text-gray-400 uppercase text-xs font-bold tracking-wider">
              Event Log
            </Text>
            <TouchableOpacity onPress={store.clearLog}>
              <Text className="text-blue-500 text-xs">Clear</Text>
            </TouchableOpacity>
          </View>
          {renderLog()}
        </View>
      </View>
    </SafeAreaView>
  );
}
