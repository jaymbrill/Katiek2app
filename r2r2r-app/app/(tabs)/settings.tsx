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
import { getStravaAuthUrl } from '../../src/lib/strava';

interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

const CONFIDENCE_LABEL = { HIGH: 'High confidence', MEDIUM: 'Medium confidence', LOW: 'Low confidence' };
const FITNESS_LABEL = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', STRONG: 'Strong', ELITE: 'Elite' };

export default function SettingsScreen() {
  const [bodyWeight, setBodyWeight] = useState('');
  const [hydrationInterval, setHydrationInterval] = useState('30');
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: '', phone: '', relation: '' }]);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  const { token, analysis, syncing, error: stravaError, disconnect, sync } = useStravaStore();

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
        <Text style={styles.sectionTitle}>Strava Integration</Text>
        {!token ? (
          <View style={styles.stravaCard}>
            <Text style={styles.stravaHeadline}>Auto-detect your fitness level</Text>
            <Text style={styles.stravaBody}>
              Connect Strava to analyze your last 12 months of runs and hikes. We calculate
              your median vertical speed to suggest the right pace category for your R2R2R plan.
            </Text>
            <TouchableOpacity
              style={styles.stravaBtn}
              onPress={connectStrava}
              accessibilityLabel="Connect Strava account"
            >
              <Text style={styles.stravaBtnText}>Connect with Strava</Text>
            </TouchableOpacity>
            <Text style={styles.stravaNote}>Read-only access to activities.</Text>
          </View>
        ) : (
          <View style={styles.stravaCard}>
            <View style={styles.stravaConnectedRow}>
              <View style={styles.stravaConnectedDot} />
              <Text style={styles.stravaConnectedText}>
                {token.athlete.firstname} {token.athlete.lastname}
              </Text>
            </View>

            {syncing && (
              <View style={styles.syncingRow}>
                <ActivityIndicator size="small" color="#FC4C02" />
                <Text style={styles.syncingText}>Analyzing your activities…</Text>
              </View>
            )}

            {stravaError && !syncing && (
              <Text style={styles.stravaErr}>{stravaError}</Text>
            )}

            {analysis && !syncing && (
              <View style={styles.analysisBox}>
                <Text style={styles.analysisLabel}>Suggested fitness level</Text>
                <Text style={styles.analysisLevel}>{FITNESS_LABEL[analysis.suggestedLevel]}</Text>
                <Text style={styles.analysisReasoning}>{analysis.reasoning}</Text>
                <Text style={styles.analysisMeta}>
                  {analysis.qualifyingActivities} qualifying activities · {CONFIDENCE_LABEL[analysis.confidence]}
                </Text>
              </View>
            )}

            <View style={styles.stravaActions}>
              <TouchableOpacity
                style={[styles.stravaActionBtn, syncing && styles.disabled]}
                onPress={sync}
                disabled={syncing}
                accessibilityLabel="Refresh Strava data"
              >
                <Text style={styles.stravaActionText}>Refresh Data</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stravaActionBtn, styles.disconnectBtn]}
                onPress={disconnect}
                accessibilityLabel="Disconnect Strava"
              >
                <Text style={[styles.stravaActionText, styles.disconnectText]}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
                  <Text style={styles.removeText}>Remove</Text>
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

  stravaCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 18 },
  stravaHeadline: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  stravaBody: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  stravaBtn: {
    backgroundColor: '#FC4C02', borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', marginBottom: 10,
  },
  stravaBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stravaNote: { color: '#475569', fontSize: 12, textAlign: 'center' },
  stravaConnectedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stravaConnectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 8 },
  stravaConnectedText: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  syncingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  syncingText: { color: '#94a3b8', fontSize: 14, marginLeft: 10 },
  stravaErr: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  analysisBox: {
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#FC4C02',
  },
  analysisLabel: {
    color: '#94a3b8', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  analysisLevel: { color: '#FC4C02', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  analysisReasoning: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  analysisMeta: { color: '#475569', fontSize: 12 },
  stravaActions: { flexDirection: 'row', gap: 10 },
  stravaActionBtn: {
    flex: 1, backgroundColor: '#334155', borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', minHeight: 40, justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  disconnectBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#475569' },
  stravaActionText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  disconnectText: { color: '#64748b' },

  contactCard: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, marginBottom: 10 },
  contactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  contactLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  removeText: { color: '#ef4444', fontSize: 14 },
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
