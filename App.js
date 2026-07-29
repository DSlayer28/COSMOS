import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BLESpikeScreen from './src/screens/BLESpikeScreen';

// In Expo SDK 57 / NativeWind v4, styling is imported globally via index.css
// which is injected automatically by the Metro config setup in tailwind.

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BLESpike" component={BLESpikeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
