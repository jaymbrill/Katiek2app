import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Guard all notification calls — expo-notifications has no web implementation
if (Platform.OS !== 'web') {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    async function setupNotifications() {
      const Notifications = require('expo-notifications');
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
    }
    setupNotifications();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="setup/index" options={{ title: 'Plan Your Trip' }} />
        <Stack.Screen name="tracker/index" options={{ title: 'Live Tracker' }} />
        <Stack.Screen
          name="tracker/checkin"
          options={{ title: 'Check In', presentation: 'modal' }}
        />
        <Stack.Screen
          name="tracker/hydration"
          options={{ title: 'Log Hydration', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
