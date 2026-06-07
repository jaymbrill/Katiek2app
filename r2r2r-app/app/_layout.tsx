import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// ErrorBoundary shown instead of blank screen on render crash
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={errStyles.container}>
      <Text style={errStyles.title}>Something went wrong</Text>
      <Text style={errStyles.msg}>{error.message}</Text>
      <TouchableOpacity style={errStyles.btn} onPress={retry}>
        <Text style={errStyles.btnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const errStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#ef4444', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  msg: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#1d4ed8', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
});

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

      </Stack>
    </>
  );
}
