import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../src/store/tripStore';
import { formatTime } from '../../src/lib/pacing';

export default function CheckInScreen() {
  const router = useRouter();
  const { activeTrip, recordCheckIn, recalculateTurnaround } = useTripStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!activeTrip) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No active trip found.</Text>
      </View>
    );
  }

  const checkedWaypointIds = new Set(activeTrip.checkIns.map((c) => c.waypointId));

  // Collect unique waypoints from segments that haven't been checked in
  const waypoints = activeTrip.scheduledSegments
    .filter((s) => !checkedWaypointIds.has(s.toWaypointId))
    .map((s) => ({
      id: s.toWaypointId,
      name: s.name.split('→')[1]?.trim() ?? s.toWaypointId,
      plannedTime: s.plannedEndTime,
    }));

  // Deduplicate
  const unique = Array.from(
    new Map(waypoints.map((w) => [w.id, w])).values()
  );

  async function handleCheckIn() {
    if (!selected || !activeTrip) return;
    const waypoint = unique.find((w) => w.id === selected);
    if (!waypoint) return;

    setSubmitting(true);
    try {
      await recordCheckIn(activeTrip.id, selected, waypoint.plannedTime);
      recalculateTurnaround();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to record check-in');
    } finally {
      setSubmitting(false);
    }
  }

  const now = new Date();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Where are you now?</Text>
      <Text style={styles.subtitle}>
        Current time: {formatTime(now)}
      </Text>

      {unique.length === 0 ? (
        <View style={styles.allDone}>
          <Text style={styles.allDoneText}>All waypoints checked in!</Text>
        </View>
      ) : (
        <>
          {unique.map((w) => {
            const delta = Math.round((now.getTime() - w.plannedTime.getTime()) / 60000);
            const isLate = delta > 0;
            return (
              <TouchableOpacity
                key={w.id}
                style={[styles.option, selected === w.id && styles.optionSelected]}
                onPress={() => setSelected(w.id)}
                accessibilityLabel={`Check in at ${w.name}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === w.id }}
              >
                <View style={[styles.radio, selected === w.id && styles.radioActive]}>
                  {selected === w.id && <View style={styles.radioDot} />}
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionName, selected === w.id && styles.optionNameActive]}>
                    {w.name}
                  </Text>
                  <View style={styles.optionMeta}>
                    <Text style={styles.plannedTime}>
                      Planned: {formatTime(w.plannedTime)}
                    </Text>
                    {delta !== 0 && (
                      <Text style={[styles.delta, isLate ? styles.deltaLate : styles.deltaEarly]}>
                        {isLate ? `+${delta}m late` : `${Math.abs(delta)}m early`}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.confirmBtn, (!selected || submitting) && styles.confirmBtnDisabled]}
            onPress={handleCheckIn}
            disabled={!selected || submitting}
            accessibilityLabel="Confirm check-in at selected waypoint"
          >
            <Text style={styles.confirmBtnText}>
              {submitting ? 'Recording…' : '✓ Confirm Check-In'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748b', fontSize: 18 },
  title: { color: '#f1f5f9', fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#64748b', fontSize: 15, marginBottom: 24 },
  allDone: { padding: 24, alignItems: 'center' },
  allDoneText: { color: '#22c55e', fontSize: 18, fontWeight: '700' },
  option: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    minHeight: 72,
  },
  optionSelected: { borderColor: '#3b82f6', backgroundColor: '#172033' },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#475569',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#3b82f6' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3b82f6' },
  optionContent: { flex: 1 },
  optionName: { color: '#94a3b8', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  optionNameActive: { color: '#93c5fd' },
  optionMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plannedTime: { color: '#64748b', fontSize: 14 },
  delta: { fontSize: 14, fontWeight: '600' },
  deltaLate: { color: '#ef4444' },
  deltaEarly: { color: '#22c55e' },
  confirmBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
