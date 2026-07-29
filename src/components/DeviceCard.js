import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

/**
 * DeviceCard
 * Shows a discovered BLE device in a list.
 */
export default function DeviceCard({ device, onPress, isConnecting }) {
  // If we don't have a name in the payload (legacy devices often don't),
  // fallback to "Unknown Device" and show the MAC/UUID instead.
  const name = device.name || 'Unknown Device';
  const id = device.id;
  const rssi = device.rssi !== null ? `${device.rssi} dBm` : 'N/A';

  return (
    <TouchableOpacity
      className="bg-gray-800 rounded-lg p-4 mb-3 flex-row justify-between items-center"
      onPress={() => onPress(device)}
      disabled={isConnecting}
    >
      <View className="flex-1">
        <Text className="text-white font-bold text-lg">{name}</Text>
        <Text className="text-gray-400 text-sm mt-1">ID: {id}</Text>
        <Text className="text-gray-500 text-xs mt-1">RSSI: {rssi}</Text>
      </View>

      <View className="ml-3">
        {isConnecting ? (
          <ActivityIndicator color="#3b82f6" />
        ) : (
          <View className="bg-blue-600 px-3 py-1 rounded">
            <Text className="text-white font-semibold">Connect</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
