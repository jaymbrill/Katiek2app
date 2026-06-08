import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTripStore } from '../../src/store/tripStore';
import { formatTime } from '../../src/lib/pacing';

const FITNESS_COLOR: Record<string, string> = {
  ELITE: '#a78bfa',
  STRONG: '#34d399',
  INTERMEDIATE: '#60a5fa',
  BEGINNER: '#fb923c',
};

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function HomeScreen() {
  const router = useRouter();
  const { trips, loadTrips } = useTripStore();

  useEffect(() => { loadTrips(); }, []);
  useFocusEffect(React.useCallback(() => { loadTrips(); }, []));

  const activeTrips = trips.filter((t) => t.status === 'IN_PROGRESS');
  const plannedTrips = trips
    .filter((t) => t.status === 'PLANNED')
    .sort((a, b) => new Date(a.tripDate).getTime() - new Date(b.tripDate).getTime());
  const pastTrips = trips
    .filter((t) => t.status === 'COMPLETED' || t.status === 'ABORTED')
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>GRAND CANYON</Text>
        <Text style={styles.heroTitle}>R2R2R</Text>
        <Text style={styles.heroSub}>Rim · River · Rim</Text>
        <View style={styles.heroStats}>
          <StatPill label="47 mi" />
          <StatPill label="11,000 ft" />
          <StatPill label="18–32 hrs" />
        </View>
      </View>

      {/* Active trip banner */}
      {activeTrips.map((trip) => (
        <TouchableOpacity
          key={trip.id}
          style={styles.activeCard}
          onPress={() => router.push('/tracker')}
          accessibilityLabel="Open live tracker"
        >
          <View style={styles.activeCardHeader}>
            <View style={styles.pulsingDot} />
            <Text style={styles.activeCardBadge}>LIVE</Text>
          </View>
          <Text style={styles.activeCardDate}>
            {new Date(trip.tripDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={styles.activeCardMeta}>
            Started {trip.startTime} · {trip.fitnessLevel}
          </Text>
          <View style={styles.activeCardCta}>
            <Text style={styles.activeCardCtaText}>Open Tracker</Text>
            <Text style={styles.activeCardCtaArrow}>→</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Plan button */}
      <TouchableOpacity
        style={styles.planBtn}
        onPress={() => router.push('/setup')}
        accessibilityLabel="Plan a new R2R2R trip"
      >
        <Text style={styles.planBtnIcon}>+</Text>
        <Text style={styles.planBtnText}>Plan a Trip</Text>
      </TouchableOpacity>

      {/* Upcoming */}
      {plannedTrips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Upcoming</Text>
          {plannedTrips.map((trip) => {
            const days = daysUntil(new Date(trip.tripDate));
            const accent = FITNESS_COLOR[trip.fitnessLevel] ?? '#60a5fa';
            return (
              <TouchableOpacity
                key={trip.id}
                style={styles.tripCard}
                onPress={() => router.push('/tracker')}
                accessibilityLabel={`Trip on ${new Date(trip.tripDate).toLocaleDateString()}`}
              >
                <View style={[styles.tripAccent, { backgroundColor: accent }]} />
                <View style={styles.tripBody}>
                  <View style={styles.tripRow}>
                    <Text style={styles.tripDate}>
                      {new Date(trip.tripDate).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </Text>
                    <View style={styles.daysChip}>
                      <Text style={styles.daysChipText}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.tripMeta}>
                    {trip.startTime} start · est. finish {formatTime(new Date(trip.targetFinishTime))}
                  </Text>
                  <View style={styles.tripTags}>
                    <Tag label={trip.fitnessLevel} color={accent} />
                    <Tag label={trip.direction === 'S_TO_N' ? 'S→N' : 'N→S'} color="#475569" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Past trips */}
      {pastTrips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>History</Text>
          {pastTrips.map((trip) => (
            <View key={trip.id} style={styles.pastCard}>
              <View style={styles.pastRow}>
                <Text style={styles.pastDate}>
                  {new Date(trip.tripDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <View style={[
                  styles.statusChip,
                  trip.status === 'COMPLETED' ? styles.statusDone : styles.statusAborted,
                ]}>
                  <Text style={styles.statusChipText}>
                    {trip.status === 'COMPLETED' ? '✓ Done' : '✗ Aborted'}
                  </Text>
                </View>
              </View>
              <Text style={styles.pastMeta}>{trip.fitnessLevel} · {trip.startTime} start</Text>
            </View>
          ))}
        </View>
      )}

      {/* Safety note */}
      <View style={styles.safetyCard}>
        <Text style={styles.safetyIcon}>⚠</Text>
        <Text style={styles.safetyText}>
          Planning aid only. Always check NPS conditions, carry a satellite communicator, and file a trip plan before entering the canyon.
        </Text>
      </View>
    </ScrollView>
  );
}

function StatPill({ label }: { label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillText}>{label}</Text>
    </View>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color + '40' }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  content: { paddingBottom: 48 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  heroLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#f1f5f9',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 8,
    lineHeight: 60,
  },
  heroSub: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: 6,
    marginBottom: 20,
  },
  heroStats: { flexDirection: 'row', gap: 8 },
  statPill: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statPillText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },

  // Active
  activeCard: {
    margin: 16,
    backgroundColor: '#0c1a0c',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  activeCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pulsingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 8,
  },
  activeCardBadge: {
    color: '#22c55e', fontSize: 11, fontWeight: '800', letterSpacing: 2,
  },
  activeCardDate: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  activeCardMeta: { color: '#64748b', fontSize: 14, marginBottom: 14 },
  activeCardCta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeCardCtaText: { color: '#22c55e', fontSize: 15, fontWeight: '700' },
  activeCardCtaArrow: { color: '#22c55e', fontSize: 15 },

  // Plan button
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    paddingVertical: 18,
    gap: 8,
  },
  planBtnIcon: { color: '#93c5fd', fontSize: 22, fontWeight: '300', lineHeight: 24 },
  planBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Section
  section: { marginTop: 8, paddingHorizontal: 16, marginBottom: 8 },
  sectionLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Trip card
  tripCard: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tripAccent: { width: 3 },
  tripBody: { flex: 1, padding: 16 },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tripDate: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  tripMeta: { color: '#475569', fontSize: 13, marginBottom: 10 },
  tripTags: { flexDirection: 'row', gap: 6 },
  daysChip: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  daysChipText: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  tagText: { fontSize: 11, fontWeight: '700' },

  // Past card
  pastCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pastRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  pastDate: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
  pastMeta: { color: '#334155', fontSize: 13 },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusDone: { backgroundColor: '#052e16' },
  statusAborted: { backgroundColor: '#2d0a0a' },
  statusChipText: { color: '#86efac', fontSize: 11, fontWeight: '700' },

  // Safety
  safetyCard: {
    flexDirection: 'row',
    margin: 16,
    marginTop: 20,
    backgroundColor: '#1a1200',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#78350f',
    gap: 10,
  },
  safetyIcon: { fontSize: 16 },
  safetyText: { flex: 1, color: '#78350f', fontSize: 12, lineHeight: 18 },
});
