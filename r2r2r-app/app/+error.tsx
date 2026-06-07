import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ErrorBoundaryProps } from 'expo-router';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{error.message}</Text>
      <TouchableOpacity style={styles.btn} onPress={retry}>
        <Text style={styles.btnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#ef4444', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  message: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 24, fontFamily: 'monospace' },
  btn: { backgroundColor: '#1d4ed8', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
});
