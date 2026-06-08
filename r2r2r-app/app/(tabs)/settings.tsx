import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { getSetting, saveSetting } from '../../src/lib/db/schema';
import { useStravaStore } from '../../src/store/stravaStore';
import type { AthleteRecord } from '../../src/store/stravaStore';
import { getStravaAuthUrl } from '../../src/lib/strava';

interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

const FITNESS_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', STRONG: 'Strong', ELITE: 'Elite',
};

function AthleteCard({ record, rank }: { record: AthleteRecord; rank: number }) {
  const { syncingIds, errors, syncAthlete, removeAthlete } = useStravaStore();
  const [expanded, setExpanded] = useState(false);
  const syncing = syncingIds.includes(record.id);
  const error = errors[record.id];
  const { analysis, token } = record;
  const name = `${token.athlete.firstname} ${token.athlete.lastname}`;

  const medalColors = ['#f59e0b', '#94a3b8', '#cd7c44'];
  const rankColor = rank <= 3 ? medalColors[rank - 1] : '#475569';

  return (
    <View style={styles.athleteCard}>
      <View style={styles.athleteHeader}>
        <View style={styles.athleteRankBadge}>
          <Text style={[styles.athleteRankText, { color: rankColor }]}>#{rank}</Text>
        </View>
        <View style={styles.athleteNameBlock}>
          <Text style={styles.athleteName}>{name}</Text>
          {analysis && (
            <Text style={styles.athleteLevel}>{FITNESS_LABEL[analysis.suggestedLevel]}</Text>
          )}
        </View>
        {analysis && (
          <View style={styles.athleteSpeedBlock}>
            <Text style={styles.athleteSpeedValue}>
              {analysis.medianVerticalSpeedFtPerHr.toLocaleString()}
            </Text>
            <Text style={styles.athleteSpeedUnit}>ft/hr</Text>
          </View>
        )}
      </View>

      {syncing && (
        <View style={styles.syncingRow}>
          <ActivityIndicator size="small" color="#FC4C02" />
          <Text style={styles.syncingText}>Analyzing activities…</Text>
        </View>
      )}

      {error && !syncing && <Text style={styles.errorText}>{error}</Text>}

      {analysis && !syncing && (
        <View style={styles.athleteStats}>
          <StatPill label="Qualifying" value={`${analysis.qualifyingCount}`} />
          <StatPill label="Weekly climb" value={`${analysis.weeklyClimbingFt.toLocaleString()} ft`} />
          <StatPill label="Confidence" value={analysis.confidence} />
        </View>
      )}

      {analysis && analysis.topEfforts.length > 0 && (
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setExpanded((v) => !v)}
          accessibilityLabel={expanded ? 'Hide efforts' : 'Show qualifying efforts'}
        >
          <Text style={styles.expandBtnText}>
            {expanded ? '▲ Hide efforts' : `▼ Show top ${analysis.topEfforts.length} efforts`}
          </Text>
        </TouchableOpacity>
      )}

      {expanded && analysis && (
        <View style={styles.effortsBox}>
          {analysis.topEfforts.map((e) => (
            <View key={e.id} style={styles.effortRow}>
              <View style={styles.effortLeft}>
                <Text style={styles.effortName} numberOfLines={1}>{e.name}</Text>
                <Text style={styles.effortMeta}>
                  {e.sport_type} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.effortRight}>
                <Text style={styles.effortGain}>{e.elevationGainFt.toLocaleString()} ft</Text>
                <Text style={styles.effortSpeed}>{e.verticalSpeedFtPerHr.toLocaleString()} ft/hr</Text>
              </View>
            </View>
          ))}
          <Text style={styles.criteriaText}>
            Criteria: 1,000+ ft gain · 10+ min · all sport types · 2-year lookback
          </Text>
        </View>
      )}

      <View style={styles.athleteActions}>
        <TouchableOpacity
          style={[styles.actionBtn, syncing && styles.disabled]}
          onPress={() => syncAthlete(record.id)}
          disabled={syncing}
          accessibilityLabel={`Refresh ${name}'s data`}
        >
          <Text style={styles.actionBtnText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.removeBtn]}
          onPress={() => removeAthlete(record.id)}
          accessibilityLabel={`Remove ${name}`}
        >
          <Text style={[styles.actionBtnText, styles.removeBtnText]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillLabel}>{label}</Text>
      <Text style={styles.statPillValue}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const [bodyWeight, setBodyWeight] = useState('');
  const [hydrationInterval, setHydrationInterval] = useState('30');
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: '', phone: '', relation: '' }]);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  const { athletes } = useStravaStore();

  // Sort athletes by median ft/hr descending
  const sortedAthletes = [...athletes].sort((a, b) => {
    const aSpeed = a.analysis?.medianVerticalSpeedFtPerHr ?? 0;
    const bSpeed = b.analysis?.medianVerticalSpeedFtPerHr ?? 0;
    return bSpeed - aSpeed;
  });

  useEffect(() => {
    async function load() {
      const weight = await getSetting('bodyWeightLbs');
      const interval = await getSetting('hydrationIntervalMin');
      const contactsJson = await getSetting('emergencyContacts');
      if (weight) setBodyWeight(weight);
      if (interval) setHydrationInterval(interval);
      if (contactsJson) {
        try { setContacts(JSON.parse(contactsJson)); } catch {}
      }
    }
    load();
  }, []);

  async function save() {
    setSaveMsg('');
    setSaveErr('');
    const w = parseFloat(bodyWeight);
    if (isNaN(w) || w < 80 || w > 350) {
      setSaveErr('Body weight must be between 80 and 350 lbs');
      return;
    }
    await saveSetting('bodyWeightLbs', bodyWeight);
    await saveSetting('hydrationIntervalMin', hydrationInterval);
    await saveSetting('emergencyContacts', JSON.stringify(contacts));
    setSaveMsg('Settings saved');
    setTimeout(() => setSaveMsg(''), 2500);
  }

  function updateContact(index: number, field: keyof EmergencyContact, value: string) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function connectStrava() {
    Linking.openURL(getStravaAuthUrl());
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile & Settings</Text>

      {/* Strava */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Strava · Group Comparison</Text>

        {sortedAthletes.length > 0 && (
          <View style={styles.leaderboardHeader}>
            <Text style={styles.leaderboardTitle}>
              {sortedAthletes.length} athlete{sortedAthletes.length !== 1 ? 's' : ''} · ranked by vertical speed
            </Text>
          </View>
        )}

        {sortedAthletes.map((record, i) => (
          <AthleteCard key={record.id} record={record} rank={i + 1} />
        ))}

        <TouchableOpacity
          style={styles.addAthleteBtn}
          onPress={connectStrava}
          accessibilityLabel="Add another Strava athlete"
        >
          <Text style={styles.addAthleteBtnText}>
            {athletes.length === 0 ? 'Connect with Strava' : '+ Add Another Athlete'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.stravaNote}>Read-only access · Strava data not shared with anyone</Text>
      </View>

      {/* Physical */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Physical</Text>
        <Field
          label="Body weight (lbs)"
          value={bodyWeight}
          onChange={setBodyWeight}
          keyboardType="numeric"
          placeholder="150"
          hint="Used to calculate hydration needs (80–350 lbs)"
          accessibilityLabel="Body weight in pounds"
        />
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Field
          label="Hydration reminder interval (minutes)"
          value={hydrationInterval}
          onChange={setHydrationInterval}
          keyboardType="numeric"
          placeholder="30"
          hint="Default: every 30 minutes"
          accessibilityLabel="Hydration reminder interval in minutes"
        />
      </View>

      {/* Emergency Contacts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Contacts</Text>
        <Text style={styles.hint}>
          Included in a pre-filled SOS message if you activate an emergency alert.
        </Text>
        {contacts.map((c, i) => (
          <View key={i} style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <Text style={styles.contactLabel}>Contact {i + 1}</Text>
              {contacts.length > 1 && (
                <TouchableOpacity
                  onPress={() => setContacts((prev) => prev.filter((_, idx) => idx !== i))}
                  accessibilityLabel={`Remove contact ${i + 1}`}
                >
                  <Text style={styles.removeContactText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            <Field label="Name" value={c.name} onChange={(v) => updateContact(i, 'name', v)} placeholder="Jane Smith" accessibilityLabel={`Contact ${i + 1} name`} />
            <Field label="Phone" value={c.phone} onChange={(v) => updateContact(i, 'phone', v)} keyboardType="phone-pad" placeholder="+1 555-000-0000" accessibilityLabel={`Contact ${i + 1} phone`} />
            <Field label="Relationship" value={c.relation} onChange={(v) => updateContact(i, 'relation', v)} placeholder="Spouse, friend, etc." accessibilityLabel={`Contact ${i + 1} relationship`} />
          </View>
        ))}
        <TouchableOpacity
          style={styles.addContactBtn}
          onPress={() => setContacts((prev) => [...prev, { name: '', phone: '', relation: '' }])}
          accessibilityLabel="Add another emergency contact"
        >
          <Text style={styles.addContactText}>+ Add Contact</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutText}>
            R2R2R Companion v1.0{'\n\n'}
            Unofficial planning and safety aid for Rim to Rim to Rim crossings. Does not replace
            official NPS guidance or your own judgment.{'\n\n'}
            Always carry a satellite communicator. File a trip plan. Know when to turn back.
          </Text>
        </View>
      </View>

      {saveErr ? <Text style={styles.saveErr}>{saveErr}</Text> : null}
      {saveMsg ? <Text style={styles.saveSuccess}>{saveMsg}</Text> : null}

      <TouchableOpacity style={styles.saveBtn} onPress={save} accessibilityLabel="Save settings">
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label, value, onChange, keyboardType, placeholder, hint, accessibilityLabel,
}: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; placeholder?: string; hint?: string; accessibilityLabel?: string;
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        accessibilityLabel={accessibilityLabel ?? label}
      />
      {hint && <Text style={fieldStyles.hint}>{hint}</Text>}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a', borderRadius: 8, padding: 12,
    color: '#f1f5f9', fontSize: 16, borderWidth: 1, borderColor: '#334155', minHeight: 44,
  },
  hint: { color: '#475569', fontSize: 12, marginTop: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#f1f5f9', fontSize: 26, fontWeight: '800', marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: '#94a3b8', fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14,
  },
  hint: { color: '#64748b', fontSize: 13, marginBottom: 12 },

  leaderboardHeader: { marginBottom: 10 },
  leaderboardTitle: { color: '#475569', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  athleteCard: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#334155',
  },
  athleteHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  athleteRankBadge: { width: 32, alignItems: 'center' },
  athleteRankText: { fontSize: 14, fontWeight: '800' },
  athleteNameBlock: { flex: 1, marginLeft: 8 },
  athleteName: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  athleteLevel: { color: '#FC4C02', fontSize: 12, fontWeight: '600', marginTop: 1 },
  athleteSpeedBlock: { alignItems: 'flex-end' },
  athleteSpeedValue: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  athleteSpeedUnit: { color: '#64748b', fontSize: 11, fontWeight: '600' },

  syncingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  syncingText: { color: '#94a3b8', fontSize: 13, marginLeft: 8 },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 8 },

  athleteStats: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  statPill: { backgroundColor: '#0f172a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  statPillLabel: { color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statPillValue: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginTop: 1 },

  expandBtn: { paddingVertical: 6, marginBottom: 4 },
  expandBtnText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },

  effortsBox: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10, marginTop: 4 },
  effortRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  effortLeft: { flex: 1, marginRight: 12 },
  effortName: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  effortMeta: { color: '#475569', fontSize: 11, marginTop: 1 },
  effortRight: { alignItems: 'flex-end' },
  effortGain: { color: '#FC4C02', fontSize: 13, fontWeight: '700' },
  effortSpeed: { color: '#475569', fontSize: 11, marginTop: 1 },
  criteriaText: { color: '#334155', fontSize: 11, lineHeight: 18, marginTop: 8 },

  athleteActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    flex: 1, backgroundColor: '#334155', borderRadius: 8, paddingVertical: 9,
    alignItems: 'center', minHeight: 38, justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  removeBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#475569' },
  actionBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  removeBtnText: { color: '#64748b' },

  addAthleteBtn: {
    backgroundColor: '#FC4C02', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 4, marginBottom: 8,
  },
  addAthleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stravaNote: { color: '#334155', fontSize: 12, textAlign: 'center', marginBottom: 4 },

  contactCard: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, marginBottom: 10 },
  contactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  contactLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  removeContactText: { color: '#ef4444', fontSize: 14 },
  addContactBtn: {
    backgroundColor: '#1e293b', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155', minHeight: 44, justifyContent: 'center',
  },
  addContactText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },

  aboutCard: { backgroundColor: '#1e293b', borderRadius: 10, padding: 16 },
  aboutText: { color: '#64748b', fontSize: 14, lineHeight: 21 },

  saveErr: { color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  saveSuccess: { color: '#22c55e', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  saveBtn: {
    backgroundColor: '#1d4ed8', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', minHeight: 52, justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
