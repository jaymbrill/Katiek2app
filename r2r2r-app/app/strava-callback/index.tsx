import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { exchangeCode } from '../../src/lib/strava';
import { useStravaStore } from '../../src/store/stravaStore';

export default function StravaCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const router = useRouter();
  const { addAthlete } = useStravaStore();
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (params.error) {
      setErrMsg('Strava authorization was denied.');
      setTimeout(() => router.replace('/(tabs)/settings' as any), 2500);
      return;
    }
    if (!params.code) {
      setErrMsg('No authorization code received.');
      setTimeout(() => router.replace('/(tabs)/settings' as any), 2500);
      return;
    }

    async function finish() {
      try {
        const token = await exchangeCode(params.code!);
        await addAthlete(token);
        router.replace('/(tabs)/settings' as any);
      } catch (e: any) {
        setErrMsg(e?.message ?? 'Authorization failed. Please try again.');
        setTimeout(() => router.replace('/(tabs)/settings' as any), 3000);
      }
    }

    finish();
  }, []);

  return (
    <View style={styles.container}>
      {errMsg ? (
        <Text style={styles.error}>{errMsg}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color="#FC4C02" />
          <Text style={styles.text}>Connecting to Strava…</Text>
          <Text style={styles.sub}>Analyzing your activity history</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: { color: '#f1f5f9', fontSize: 17, marginTop: 20, fontWeight: '600' },
  sub: { color: '#64748b', fontSize: 14, marginTop: 8 },
  error: { color: '#ef4444', fontSize: 16, textAlign: 'center', lineHeight: 24 },
});
