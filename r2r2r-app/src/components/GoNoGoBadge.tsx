import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConditionStatus } from '../lib/types';

interface Props {
  status: ConditionStatus;
  large?: boolean;
}

export function GoNoGoBadge({ status, large = false }: Props) {
  const config = {
    GO: { bg: '#16a34a', text: 'GO', label: 'Conditions look good' },
    CAUTION: { bg: '#d97706', text: '⚠ CAUTION', label: 'Elevated risk — proceed carefully' },
    NO_GO: { bg: '#dc2626', text: '✕ NO GO', label: 'Do not attempt today' },
  }[status];

  return (
    <View style={[styles.container, { backgroundColor: config.bg }, large && styles.large]}>
      <Text style={[styles.text, large && styles.largeText]}>{config.text}</Text>
      {large && <Text style={styles.label}>{config.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
  largeText: {
    fontSize: 28,
    letterSpacing: 2,
  },
  label: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
});
