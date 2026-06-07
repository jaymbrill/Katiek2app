import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../src/store/tripStore';
import { formatTime } from '../../src/lib/pacing';

export default function HomeScreen() {
  const router = useRouter();
  const { trips, loadTrips } = useTripStore();

  useEffect(() => {
    loadTrips();
  }, []);

  const plannedTrips = trips.filter((t) => t.status === 'PLANNED');
  const activeTrips = trips.filter((t) => t.status === 'IN_PROGRESS');
  const pastTrips = trips.filter((t) =>
    t.status === 'COMPLETED' || t.status === 'ABORTED'
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.appTitle}>R2R2R</Text>
      <Text style={styles.appSubtitle}>Rim to Rim to Rim Companion</Text>

      {activeTrips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Trip</Text>
          {activeTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={styles.activeTripCard}
              onPress={() => router.push('/tracker')}
              accessibilityLabel={`Active trip on ${trip.tripDate.toLocaleDateString()}, tap to open tracker`}
            >
              <Text style={styles.activeLabel}>IN PROGRESS</Text>
              <Text style={styles.tripDate}>
                {trip.tripDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
              <Text style={styles.tripMeta}>
                Start {trip.startTime} · {trip.fitnessLevel} · {trip.bodyWeightLbs} lbs
              </Text>
              <Text style={styles.trackerCta}>Open Live Tracker →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.planButton}
        onPress={() => router.push('/setup')}
        accessibilityLabel="Plan a new R2R2R trip"
      >
        <Text style={styles.planButtonText}>+ Plan a Trip</Text>
      </TouchableOpacity>

      {plannedTrips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {plannedTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={styles.tripCard}
              onPress={() => router.push('/tracker')}
              accessibilityLabel={`Planned trip on ${trip.tripDate.toLocaleDateString()}`}
            >
              <Text style={styles.tripDate}>
                {trip.tripDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.tripMeta}>
                {trip.startTime} start · {trip.fitnessLevel} ·{' '}
                {formatTime(trip.targetFinishTime)} est. finish
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {pastTrips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Trips</Text>
          {pastTrips.slice(0, 5).map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.pastRow}>
                <Text style={styles.tripDate}>
                  {trip.tripDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    trip.status === 'COMPLETED'
                      ? styles.statusCompleted
                      : styles.statusAborted,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {trip.status === 'COMPLETED' ? 'Completed' : 'Aborted'}
                  </Text>
                </View>
              </View>
              <Text style={styles.tripMeta}>{trip.fitnessLevel} · {trip.startTime} start</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          ⚠ This app is a planning aid only. Always check official NPS conditions,
          carry a satellite communicator, and file a trip plan with someone before entering the canyon.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  appTitle: {
    color: '#f1f5f9',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: 24,
  },
  appSubtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 1,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  planButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 28,
    minHeight: 56,
    justifyContent: 'center',
  },
  planButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  activeTripCard: {
    backgroundColor: '#172033',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  activeLabel: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  tripCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  tripDate: { color: '#f1f5f9', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  tripMeta: { color: '#64748b', fontSize: 14 },
  trackerCta: { color: '#3b82f6', fontSize: 14, fontWeight: '600', marginTop: 10 },
  pastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusCompleted: { backgroundColor: '#14532d' },
  statusAborted: { backgroundColor: '#7f1d1d' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  disclaimer: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
  },
  disclaimerText: { color: '#64748b', fontSize: 13, lineHeight: 19 },
});
