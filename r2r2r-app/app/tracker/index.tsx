import React, { useEffect, useState } from 'react';
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
import { SegmentCard } from '../../src/components/SegmentCard';
import { HydrationTimer } from '../../src/components/HydrationTimer';
import { TurnaroundModal } from '../../src/components/TurnaroundModal';
import { formatTime } from '../../src/lib/pacing';
import { checkHyponatremiaRisk } from '../../src/lib/hydration';

export default function TrackerScreen() {
  const router = useRouter();
  const {
    trips,
    activeTrip,
    loadActiveTrip,
    loadForecast,
    setTripStatus,
    turnaroundAssessment,
    logHydration,
    overrideTurnaround,
    recalculateTurnaround,
  } = useTripStore();

  const [turnaroundVisible, setTurnaroundVisible] = useState(false);

  const trip =
    activeTrip ??
    trips.find((t) => t.status === 'IN_PROGRESS' || t.status === 'PLANNED');

  useEffect(() => {
    if (trip) {
      loadActiveTrip(trip.id);
      loadForecast(trip.tripDate);
    }
  }, [trip?.id]);

  useEffect(() => {
    const interval = setInterval(recalculateTurnaround, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Show turnaround modal automatically on TURN_BACK_NOW
  useEffect(() => {
    if (turnaroundAssessment?.recommendation === 'TURN_BACK_NOW') {
      setTurnaroundVisible(true);
    }
  }, [turnaroundAssessment?.recommendation]);

  if (!trip) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No active trip.</Text>
        <TouchableOpacity
          style={styles.planBtn}
          onPress={() => router.push('/setup')}
          accessibilityLabel="Plan a new trip"
        >
          <Text style={styles.planBtnText}>Plan a Trip</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hypoRisk = checkHyponatremiaRisk(trip.hydrationLog);
  const completedWaypointIds = new Set(trip.checkIns.map((c) => c.waypointId));
  const delay = trip.checkIns.reduce((sum, c) => sum + c.deltaMinutes, 0);

  async function startTrip() {
    await setTripStatus(trip!.id, 'IN_PROGRESS');
  }

  async function handleOverride() {
    await overrideTurnaround(trip!.id);
    setTurnaroundVisible(false);
  }

  return (
    <>
      {turnaroundAssessment && (
        <TurnaroundModal
          visible={turnaroundVisible}
          assessment={turnaroundAssessment}
          onDismiss={() => setTurnaroundVisible(false)}
          onOverride={handleOverride}
        />
      )}

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Status header */}
        <View style={styles.statusBar}>
          <View>
            <Text style={styles.statusLabel}>
              {trip.status === 'PLANNED' ? 'PLANNED' : 'IN PROGRESS'}
            </Text>
            <Text style={styles.tripDate}>
              {trip.tripDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.paceInfo}>
            {delay !== 0 && (
              <Text style={[styles.delay, delay > 0 ? styles.delayBehind : styles.delayAhead]}>
                {delay > 0 ? `+${delay}m behind` : `${Math.abs(delay)}m ahead`}
              </Text>
            )}
            <Text style={styles.finishEst}>
              Est. finish {formatTime(trip.targetFinishTime)}
            </Text>
          </View>
        </View>

        {hypoRisk && (
          <View style={styles.hypoWarn}>
            <Text style={styles.hypoWarnText}>
              ⚠ 2+ hours without electrolytes — hyponatremia risk! Take electrolytes now.
            </Text>
          </View>
        )}

        {turnaroundAssessment && turnaroundAssessment.recommendation !== 'CONTINUE' && (
          <TouchableOpacity
            style={[
              styles.turnaroundBanner,
              turnaroundAssessment.recommendation === 'TURN_BACK_NOW'
                ? styles.turnaroundRed
                : styles.turnaroundYellow,
            ]}
            onPress={() => setTurnaroundVisible(true)}
            accessibilityLabel="View turnaround assessment"
          >
            <Text style={styles.turnaroundBannerText}>
              {turnaroundAssessment.recommendation === 'TURN_BACK_NOW'
                ? '🔴 TURN BACK NOW — tap for details'
                : '⚠ Consider turning back — tap for details'}
            </Text>
          </TouchableOpacity>
        )}

        {trip.status === 'PLANNED' && (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={startTrip}
            accessibilityLabel="Start trip"
          >
            <Text style={styles.startBtnText}>▶ Start Trip</Text>
          </TouchableOpacity>
        )}

        {/* Hydration */}
        {trip.status === 'IN_PROGRESS' && (
          <HydrationTimer
            onLog={(oz, elec) => logHydration(trip.id, oz, elec)}
          />
        )}

        {/* Check In button */}
        {trip.status === 'IN_PROGRESS' && (
          <TouchableOpacity
            style={styles.checkInBtn}
            onPress={() => router.push('/tracker/checkin')}
            accessibilityLabel="Check in at current waypoint"
          >
            <Text style={styles.checkInBtnText}>📍 Waypoint Check-In</Text>
          </TouchableOpacity>
        )}

        {/* Segment list */}
        <Text style={styles.sectionTitle}>Route Plan</Text>
        {trip.scheduledSegments.map((seg) => {
          const isCompleted = completedWaypointIds.has(seg.toWaypointId);
          const isActive =
            !isCompleted &&
            trip.checkIns.some((c) => c.waypointId === seg.fromWaypointId);
          return (
            <SegmentCard
              key={seg.id}
              segment={seg}
              isActive={isActive}
              isCompleted={isCompleted}
            />
          );
        })}

        {trip.status === 'IN_PROGRESS' && (
          <TouchableOpacity
            style={styles.abortBtn}
            onPress={() =>
              Alert.alert(
                'Abort Trip',
                'Mark this trip as aborted? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Abort',
                    style: 'destructive',
                    onPress: () => setTripStatus(trip.id, 'ABORTED'),
                  },
                ]
              )
            }
            accessibilityLabel="Abort trip"
          >
            <Text style={styles.abortBtnText}>Abort Trip</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#64748b', fontSize: 18, marginBottom: 20 },
  planBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48,
    justifyContent: 'center',
  },
  planBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statusLabel: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  tripDate: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  paceInfo: { alignItems: 'flex-end' },
  delay: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  delayBehind: { color: '#ef4444' },
  delayAhead: { color: '#22c55e' },
  finishEst: { color: '#64748b', fontSize: 13 },
  hypoWarn: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  hypoWarnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  turnaroundBanner: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    minHeight: 52,
    justifyContent: 'center',
  },
  turnaroundRed: { backgroundColor: '#7f1d1d' },
  turnaroundYellow: { backgroundColor: '#78350f' },
  turnaroundBannerText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  startBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    minHeight: 52,
    justifyContent: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  checkInBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 48,
    justifyContent: 'center',
  },
  checkInBtnText: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 8,
  },
  abortBtn: {
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  abortBtnText: { color: '#ef4444', fontSize: 15 },
});
