import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStravaStore } from '../../src/store/stravaStore';
import type { AthleteRecord } from '../../src/store/stravaStore';
import { getStravaAuthUrl } from '../../src/lib/strava';

const EVENT_DATE = new Date('2026-10-07T00:00:00');
const EVENT_LABEL = 'October 7th, 2026';

const FITNESS_COLOR: Record<string, string> = {
  ELITE: '#a78bfa',
  STRONG: '#34d399',
  INTERMEDIATE: '#60a5fa',
  BEGINNER: '#fb923c',
};

const FITNESS_LABEL: Record<string, string> = {
  ELITE: 'Elite', STRONG: 'Strong', INTERMEDIATE: 'Intermediate', BEGINNER: 'Beginner',
};

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Leaderboard 1: Vertical Speed ──────────────────────────────────────────

function SpeedRow({ record, rank }: { record: AthleteRecord; rank: number }) {
  const { syncingIds, errors, syncAthlete, removeAthlete, updateTripDate } = useStravaStore();
  const [expanded, setExpanded] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState(record.tripDate ?? '2026-10-07');
  const syncing = syncingIds.includes(record.id);
  const error = errors[record.id];
  const { analysis } = record;
  const name = [record.firstname, record.lastname].filter(Boolean).join(' ') || 'Unknown Athlete';
  const level = analysis?.suggestedLevel ?? null;
  const accent = level ? FITNESS_COLOR[level] : '#475569';

  const medalColors = ['#f59e0b', '#94a3b8', '#cd7c44'];
  const rankColor = rank <= 3 ? medalColors[rank - 1] : '#334155';

  return (
    <View style={styles.athleteCard}>
      <View style={styles.athleteRow}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor + '22', borderColor: rankColor }]}>
          <Text style={[styles.rankText, { color: rankColor }]}>{rank}</Text>
        </View>
        <View style={styles.athleteInfo}>
          <Text style={styles.athleteName}>{name}</Text>
          {level && (
            <Text style={[styles.athleteLevel, { color: accent }]}>{FITNESS_LABEL[level]}</Text>
          )}
        </View>
        {analysis && (
          <View style={styles.speedBlock}>
            <Text style={styles.speedValue}>{(analysis.medianVerticalSpeedFtPerHr ?? 0).toLocaleString()}</Text>
            <Text style={styles.speedUnit}>ft/hr</Text>
          </View>
        )}
        {syncing && <ActivityIndicator size="small" color="#FC4C02" style={{ marginLeft: 8 }} />}
      </View>

      {analysis && !syncing && (
        <View style={styles.pillRow}>
          <Pill label={`${analysis.qualifyingCount} qualifying`} />
          <Pill label={`${analysis.weeklyClimbingFt.toLocaleString()} ft/wk`} />
          <Pill label={analysis.confidence} />
        </View>
      )}

      {error && !syncing && <Text style={styles.errorText}>{error}</Text>}

      {analysis && analysis.topEfforts.length > 0 && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          style={styles.expandBtn}
          accessibilityLabel={expanded ? 'Hide efforts' : 'Show efforts'}
        >
          <Text style={styles.expandText}>
            {expanded ? '▲ Hide efforts' : `▼ Top ${analysis.topEfforts.length} qualifying efforts`}
          </Text>
        </TouchableOpacity>
      )}

      {expanded && analysis && (
        <View style={styles.effortsList}>
          {analysis.topEfforts.map((e) => (
            <View key={e.id} style={styles.effortRow}>
              <View style={styles.effortLeft}>
                <Text style={styles.effortName} numberOfLines={1}>{e.name}</Text>
                <Text style={styles.effortMeta}>
                  {e.sport_type} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {e.city ? ` · ${e.city}` : ''}
                </Text>
              </View>
              <View style={styles.effortRight}>
                <Text style={styles.effortGain}>{e.elevationGainFt.toLocaleString()} ft</Text>
                <Text style={styles.effortFtHr}>{(e.verticalSpeedFtPerHr ?? 0).toLocaleString()} ft/hr</Text>
              </View>
            </View>
          ))}
          <Text style={styles.effortCriteria}>
            1,000+ ft gain · 10+ min · all sport types · 2-year lookback
          </Text>
        </View>
      )}

      {/* Trip date */}
      <View style={styles.tripDateRow}>
        {editingDate ? (
          <>
            <TextInput
              style={styles.tripDateInput}
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#475569"
              accessibilityLabel="Trip date"
            />
            <TouchableOpacity
              style={styles.tripDateSave}
              onPress={() => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                  updateTripDate(record.id, dateInput);
                  setEditingDate(false);
                }
              }}
            >
              <Text style={styles.tripDateSaveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingDate(false)} style={styles.tripDateCancel}>
              <Text style={styles.tripDateCancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={() => { setDateInput(record.tripDate ?? '2026-10-07'); setEditingDate(true); }} style={styles.tripDateBtn}>
            <Text style={styles.tripDateLabel}>
              📅 {new Date((record.tripDate ?? '2026-10-07') + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.athleteActions}>
        <TouchableOpacity
          style={[styles.actionChip, syncing && styles.disabled]}
          onPress={() => syncAthlete(record.id)}
          disabled={syncing}
        >
          <Text style={styles.actionChipText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionChip, styles.removeChip]}
          onPress={() => removeAthlete(record.id)}
        >
          <Text style={[styles.actionChipText, styles.removeChipText]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Leaderboard 2: Longest Hike/Run ────────────────────────────────────────

function DistanceRow({ record, rank }: { record: AthleteRecord; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const { analysis } = record;
  const name = [record.firstname, record.lastname].filter(Boolean).join(' ') || 'Unknown Athlete';
  const miles = analysis?.longestHikeRunMiles ?? 0;
  const synced = analysis != null;
  const efforts = analysis?.topHikeRunEfforts ?? [];

  const medalColors = ['#f59e0b', '#94a3b8', '#cd7c44'];
  const rankColor = rank <= 3 && miles > 0 ? medalColors[rank - 1] : '#334155';

  return (
    <View style={styles.distanceCard}>
      {/* Header row */}
      <View style={styles.distanceHeaderRow}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor + '22', borderColor: rankColor }]}>
          <Text style={[styles.rankText, { color: rankColor }]}>{rank}</Text>
        </View>
        <View style={styles.distanceInfo}>
          <Text style={styles.distanceName}>{name}</Text>
          {synced && miles === 0 && (
            <Text style={styles.distanceNote}>no hike/run over 10 mi on record</Text>
          )}
          {!synced && (
            <Text style={styles.distanceNote}>syncing…</Text>
          )}
        </View>
        <View style={styles.distanceBlock}>
          {miles > 0 ? (
            <>
              <Text style={styles.distanceValue}>{miles}</Text>
              <Text style={styles.distanceUnit}>mi</Text>
            </>
          ) : (
            <Text style={styles.distanceNone}>—</Text>
          )}
        </View>
      </View>

      {/* Expandable efforts */}
      {efforts.length > 0 && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          style={styles.expandBtn}
          accessibilityLabel={expanded ? 'Hide long efforts' : 'Show long efforts'}
        >
          <Text style={styles.expandText}>
            {expanded ? '▲ Hide efforts' : `▼ Top ${efforts.length} long efforts`}
          </Text>
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.effortsList}>
          {efforts.map((e) => (
            <View key={e.id} style={styles.effortRow}>
              <View style={styles.effortLeft}>
                <Text style={styles.effortName} numberOfLines={1}>{e.name}</Text>
                <Text style={styles.effortMeta}>
                  {e.sport_type} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {e.city ? ` · ${e.city}` : ''}
                </Text>
              </View>
              <View style={styles.effortRight}>
                <Text style={styles.effortGain}>{e.distanceMiles} mi</Text>
                {e.elevationGainFt > 0 && (
                  <Text style={styles.effortFtHr}>{e.elevationGainFt.toLocaleString()} ft gain</Text>
                )}
              </View>
            </View>
          ))}
          <Text style={styles.effortCriteria}>
            Runs, hikes & walks · over 10 miles · 2-year lookback
          </Text>
        </View>
      )}
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const DEFAULT_DATE = '2026-10-07';

export default function GroupScreen() {
  const router = useRouter();
  const { athletes, loadAthletes, connecting, connectError } = useStravaStore();
  const [filterDate, setFilterDate] = useState<string | null>(DEFAULT_DATE); // starts on default date

  useEffect(() => { loadAthletes(); }, []);

  // Unique dates across all athletes
  const uniqueDates = [...new Set(
    athletes.map((a) => a.tripDate ?? DEFAULT_DATE)
  )].sort();

  const visibleAthletes = filterDate
    ? athletes.filter((a) => (a.tripDate ?? DEFAULT_DATE) === filterDate)
    : athletes;

  const sortedBySpeed = [...visibleAthletes].sort(
    (a, b) => (b.analysis?.medianVerticalSpeedFtPerHr ?? 0) - (a.analysis?.medianVerticalSpeedFtPerHr ?? 0)
  );

  const sortedByDistance = [...visibleAthletes].sort(
    (a, b) => (b.analysis?.longestHikeRunMiles ?? 0) - (a.analysis?.longestHikeRunMiles ?? 0)
  );

  const days = daysUntil(EVENT_DATE);
  const daysLabel =
    days > 0 ? `${days} days away` : days === 0 ? 'Today!' : `${Math.abs(days)} days ago`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Event hero */}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>GRAND CANYON</Text>
        <Text style={styles.heroTitle}>R2R2R</Text>

        <View style={styles.eventBanner}>
          <Text style={styles.eventDate}>{EVENT_LABEL}</Text>
          <View style={styles.daysChip}>
            <Text style={styles.daysChipText}>{daysLabel}</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <StatPill label="47 mi" />
          <StatPill label="11,000 ft gain" />
          <StatPill label="South Kaibab → Bright Angel" />
        </View>
      </View>

      {/* Connecting banner */}
      {connecting && (
        <View style={styles.connectingBanner}>
          <ActivityIndicator size="small" color="#FC4C02" />
          <View style={styles.connectingText}>
            <Text style={styles.connectingTitle}>Connecting your Strava…</Text>
            <Text style={styles.connectingSub}>Fetching 2 years of activity data. If this is your first connection today, the server may need 30s to wake up — hang tight.</Text>
          </View>
        </View>
      )}

      {/* Connect error */}
      {!connecting && connectError ? (
        <View style={styles.connectErrorBanner}>
          <Text style={styles.connectErrorTitle}>Connection failed</Text>
          <Text style={styles.connectErrorMsg}>{connectError}</Text>
        </View>
      ) : null}

      {/* Date filter bar — only show if there are athletes */}
      {athletes.length > 0 && (
        <View style={styles.filterBar}>
          <Text style={styles.filterLabel}>Show group:</Text>
          <View style={styles.filterChips}>
            <TouchableOpacity
              style={[styles.filterChip, filterDate === null && styles.filterChipActive]}
              onPress={() => setFilterDate(null)}
            >
              <Text style={[styles.filterChipText, filterDate === null && styles.filterChipTextActive]}>
                All Dates
              </Text>
            </TouchableOpacity>
            {uniqueDates.map((d) => {
              const label = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const active = filterDate === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilterDate(active ? null : d)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Leaderboard 1: Vertical Speed */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {filterDate
              ? `${sortedBySpeed.length} Athletes · ${new Date(filterDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : 'Vertical Speed Leaderboard'}
          </Text>
          <Text style={styles.sectionSub}>ft/hr · all elevating activities · 2-yr lookback</Text>
        </View>

        {sortedBySpeed.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No athletes yet</Text>
            <Text style={styles.emptyBody}>
              Everyone in the group connects their Strava below. We'll pull 2 years of climbs to rank
              each person by their median vertical speed (ft/hr) — a reliable predictor of canyon pace.
            </Text>
          </View>
        )}

        {sortedBySpeed.map((record, i) => (
          <SpeedRow key={record.id} record={record} rank={i + 1} />
        ))}
      </View>

      {/* Leaderboard 2: Longest Hike/Run */}
      {visibleAthletes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {filterDate
                ? `${sortedByDistance.length} Athletes · Longest Hike/Run · ${new Date(filterDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'Longest Hike / Run'}
            </Text>
            <Text style={styles.sectionSub}>runs, hikes & walks only · no biking or skiing</Text>
          </View>

          {sortedByDistance.map((record, i) => (
            <DistanceRow key={record.id} record={record} rank={i + 1} />
          ))}
        </View>
      )}

      {/* Connect button */}
      <View style={styles.connectSection}>
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={() => Linking.openURL(getStravaAuthUrl())}
          accessibilityLabel="Connect your Strava account"
        >
          <Text style={styles.connectBtnText}>
            {athletes.length === 0 ? 'Connect with Strava' : '+ Add Your Strava'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.connectNote}>Read-only · each athlete connects on their own device</Text>
      </View>

      {/* Trip tools */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Tools</Text>
        <View style={styles.toolGrid}>
          <ToolCard
            icon="📋"
            label="Plan Trip"
            desc="Build a personal pacing schedule"
            onPress={() => router.push('/setup')}
          />
          <ToolCard
            icon="🌡"
            label="Conditions"
            desc="Weather & canyon temps"
            onPress={() => router.push('/(tabs)/conditions' as any)}
          />
          <ToolCard
            icon="🎒"
            label="Gear"
            desc="Packing checklist"
            onPress={() => router.push('/(tabs)/gear' as any)}
          />
          <ToolCard
            icon="👤"
            label="Profile"
            desc="Settings & contacts"
            onPress={() => router.push('/(tabs)/settings' as any)}
          />
        </View>
      </View>

      {/* Safety */}
      <View style={styles.safetyCard}>
        <Text style={styles.safetyIcon}>⚠</Text>
        <Text style={styles.safetyText}>
          Planning aid only. Check NPS conditions, carry a satellite communicator, and file a trip plan before entering the canyon.
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

function ToolCard({ icon, label, desc, onPress }: { icon: string; label: string; desc: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.toolCard} onPress={onPress} accessibilityLabel={label}>
      <Text style={styles.toolIcon}>{icon}</Text>
      <Text style={styles.toolLabel}>{label}</Text>
      <Text style={styles.toolDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  content: { paddingBottom: 56 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  heroEyebrow: { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 4, marginBottom: 6 },
  heroTitle: { color: '#f1f5f9', fontSize: 64, fontWeight: '900', letterSpacing: 10, lineHeight: 68 },
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  eventDate: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  daysChip: { backgroundColor: '#1e3a5f', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  daysChipText: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  statPill: {
    backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#334155',
  },
  statPillText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },

  // Section
  section: { paddingHorizontal: 16, paddingTop: 24, marginBottom: 4 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: {
    color: '#94a3b8', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  sectionSub: { color: '#334155', fontSize: 11, marginTop: 3 },

  // Empty state
  emptyState: {
    backgroundColor: '#111827', borderRadius: 14, padding: 22,
    borderWidth: 1, borderColor: '#1e293b', marginBottom: 12,
  },
  emptyTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#64748b', fontSize: 14, lineHeight: 21 },

  // Speed leaderboard card
  athleteCard: {
    backgroundColor: '#111827', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#1e293b',
  },
  athleteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rankBadge: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rankText: { fontSize: 13, fontWeight: '800' },
  athleteInfo: { flex: 1 },
  athleteName: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  athleteLevel: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  speedBlock: { alignItems: 'flex-end' },
  speedValue: { color: '#f1f5f9', fontSize: 22, fontWeight: '900' },
  speedUnit: { color: '#475569', fontSize: 10, fontWeight: '600' },

  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  pill: { backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { color: '#64748b', fontSize: 11, fontWeight: '600' },

  errorText: { color: '#ef4444', fontSize: 12, marginBottom: 6 },

  expandBtn: { paddingVertical: 5, marginBottom: 4 },
  expandText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },

  effortsList: { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 10, marginBottom: 4 },
  effortRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#0f172a',
  },
  effortLeft: { flex: 1, marginRight: 12 },
  effortName: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  effortMeta: { color: '#475569', fontSize: 11, marginTop: 1 },
  effortRight: { alignItems: 'flex-end' },
  effortGain: { color: '#FC4C02', fontSize: 13, fontWeight: '700' },
  effortFtHr: { color: '#475569', fontSize: 11, marginTop: 1 },
  effortCriteria: { color: '#334155', fontSize: 11, marginTop: 8, lineHeight: 17 },

  filterBar: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  filterLabel: {
    color: '#64748b', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10,
  },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: '#1e3a5f', borderColor: '#3b82f6' },
  filterChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#93c5fd', fontWeight: '700' },

  tripDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 2 },
  tripDateBtn: { paddingVertical: 4 },
  tripDateLabel: { color: '#475569', fontSize: 12 },
  tripDateInput: {
    flex: 1, backgroundColor: '#0f172a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
    color: '#f1f5f9', fontSize: 13, borderWidth: 1, borderColor: '#334155',
  },
  tripDateSave: {
    backgroundColor: '#1d4ed8', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6,
  },
  tripDateSaveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tripDateCancel: { paddingHorizontal: 8, paddingVertical: 6 },
  tripDateCancelText: { color: '#475569', fontSize: 12 },

  athleteActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionChip: {
    backgroundColor: '#1e293b', borderRadius: 7, paddingHorizontal: 14, paddingVertical: 7,
  },
  disabled: { opacity: 0.5 },
  removeChip: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' },
  actionChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  removeChipText: { color: '#475569' },

  // Distance leaderboard card
  distanceCard: {
    backgroundColor: '#111827', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#1e293b',
  },
  distanceHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  distanceInfo: { flex: 1, marginLeft: 12 },
  distanceName: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  distanceNote: { color: '#475569', fontSize: 11, marginTop: 2 },
  distanceBlock: { flexDirection: 'row', gap: 3, alignItems: 'baseline' },
  distanceValue: { color: '#34d399', fontSize: 22, fontWeight: '900' },
  distanceUnit: { color: '#475569', fontSize: 10, fontWeight: '600' },
  distanceNone: { color: '#334155', fontSize: 18, fontWeight: '700' },

  // Connect
  connectSection: { paddingHorizontal: 16, paddingTop: 8, marginBottom: 4 },
  connectBtn: {
    backgroundColor: '#FC4C02', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginBottom: 8,
  },
  connectBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  connectNote: { color: '#334155', fontSize: 12, textAlign: 'center' },

  // Connecting / error banners
  connectingBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#1a0d00', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#FC4C02',
  },
  connectingText: { flex: 1 },
  connectingTitle: { color: '#FC4C02', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  connectingSub: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  connectErrorBanner: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#1a0000', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#ef4444',
  },
  connectErrorTitle: { color: '#ef4444', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  connectErrorMsg: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },

  // Tool grid
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  toolCard: {
    width: '47%',
    backgroundColor: '#111827', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1e293b',
  },
  toolIcon: { fontSize: 24, marginBottom: 8 },
  toolLabel: { color: '#e2e8f0', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  toolDesc: { color: '#475569', fontSize: 12, lineHeight: 17 },

  // Safety
  safetyCard: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 20,
    backgroundColor: '#1a1200', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#78350f', gap: 10,
  },
  safetyIcon: { fontSize: 14 },
  safetyText: { flex: 1, color: '#78350f', fontSize: 12, lineHeight: 18 },
});
