import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTripStore } from '../../src/store/tripStore';
import { GoNoGoBadge } from '../../src/components/GoNoGoBadge';
import { evaluateConditions, isNorthRimWaterOff } from '../../src/lib/turnaround';
import waterSourcesData from '../../src/constants/waterSources.json';
import type { WaterSource, ConditionStatus } from '../../src/lib/types';

export default function ConditionsScreen() {
  const { forecast, forecastLoading, loadForecast } = useTripStore();
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus>('CAUTION');
  const [waterSources] = useState<WaterSource[]>(waterSourcesData as WaterSource[]);

  useEffect(() => {
    const tripDate = new Date();
    loadForecast(tripDate);
  }, []);

  useEffect(() => {
    if (forecast) {
      const sources = waterSources.map((s) => ({
        ...s,
        status: s.id === 'north_rim' && isNorthRimWaterOff(new Date()) ? 'DOWN' as const : s.status,
      }));
      const status = evaluateConditions(forecast, sources, new Date());
      setConditionStatus(status);
    }
  }, [forecast, waterSources]);

  function refresh() {
    loadForecast(new Date());
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Conditions</Text>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn} accessibilityLabel="Refresh conditions">
          <Text style={styles.refreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      {forecastLoading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={styles.loader} />
      ) : (
        <>
          <GoNoGoBadge status={conditionStatus} large />

          {forecast && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Inner Gorge Forecast</Text>
              <View style={styles.tempRow}>
                <Text style={styles.tempValue}>{forecast.innerGorgeHighF}°F</Text>
                <Text style={styles.tempLabel}>Predicted High</Text>
              </View>
              <Text style={styles.summary}>{forecast.summary}</Text>
              {forecast.lastUpdated.getTime() === 0 ? (
                <Text style={styles.offline}>⚡ Offline — seasonal estimate</Text>
              ) : (
                <Text style={styles.updated}>
                  Updated {forecast.lastUpdated.toLocaleTimeString()}
                </Text>
              )}
            </View>
          )}

          <Text style={styles.sectionTitle}>Water Sources</Text>
          {waterSources.map((source) => {
            const effectiveStatus =
              source.id === 'north_rim' && isNorthRimWaterOff(new Date())
                ? 'DOWN'
                : source.status;
            return (
              <View key={source.id} style={styles.waterCard}>
                <View style={styles.waterHeader}>
                  <Text style={styles.waterName}>{source.name}</Text>
                  <WaterStatusBadge status={effectiveStatus} critical={source.critical} />
                </View>
                <Text style={styles.waterMile}>{source.mileFromSouthTH} mi from South TH</Text>
                {source.notes ? (
                  <Text style={styles.waterNotes}>{source.notes}</Text>
                ) : null}
              </View>
            );
          })}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Temperature Guidelines</Text>
            <ConditionRow temp="< 100°F" status="GO" label="Go for it" />
            <ConditionRow temp="100–109°F" status="CAUTION" label="Possible with early start" />
            <ConditionRow temp="≥ 110°F" status="NO_GO" label="Life-threatening — do not go" />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function WaterStatusBadge({
  status,
  critical,
}: {
  status: string;
  critical: boolean;
}) {
  const colors: Record<string, string> = {
    OPEN: '#16a34a',
    SEASONAL: '#d97706',
    DOWN: '#dc2626',
  };
  return (
    <View
      style={[
        statusStyles.badge,
        { backgroundColor: colors[status] ?? '#64748b' },
      ]}
    >
      <Text style={statusStyles.text}>
        {status}{critical ? ' ★' : ''}
      </Text>
    </View>
  );
}

const statusStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

function ConditionRow({
  temp,
  status,
  label,
}: {
  temp: string;
  status: ConditionStatus;
  label: string;
}) {
  const colors: Record<ConditionStatus, string> = {
    GO: '#16a34a',
    CAUTION: '#d97706',
    NO_GO: '#dc2626',
  };
  return (
    <View style={condStyles.row}>
      <Text style={condStyles.temp}>{temp}</Text>
      <View style={[condStyles.dot, { backgroundColor: colors[status] }]} />
      <Text style={condStyles.label}>{label}</Text>
    </View>
  );
}

const condStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  temp: { color: '#94a3b8', fontSize: 14, width: 90 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 8 },
  label: { color: '#e2e8f0', fontSize: 14, flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { color: '#f1f5f9', fontSize: 26, fontWeight: '800' },
  refreshBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  refreshText: { color: '#3b82f6', fontWeight: '600', fontSize: 16 },
  loader: { marginTop: 60 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  cardTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  tempRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  tempValue: { color: '#f1f5f9', fontSize: 48, fontWeight: '800' },
  tempLabel: { color: '#64748b', fontSize: 14 },
  summary: { color: '#cbd5e1', fontSize: 15, marginBottom: 8 },
  offline: { color: '#d97706', fontSize: 13 },
  updated: { color: '#64748b', fontSize: 13 },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 8,
  },
  waterCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  waterName: { color: '#e2e8f0', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  waterMile: { color: '#64748b', fontSize: 13, marginBottom: 2 },
  waterNotes: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
});
