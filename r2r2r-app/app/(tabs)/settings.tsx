import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { getSetting, saveSetting } from '../../src/lib/db/schema';

interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export default function SettingsScreen() {
  const [bodyWeight, setBodyWeight] = useState('');
  const [hydrationInterval, setHydrationInterval] = useState('30');
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { name: '', phone: '', relation: '' },
  ]);

  useEffect(() => {
    async function load() {
      const weight = await getSetting('bodyWeightLbs');
      const interval = await getSetting('hydrationIntervalMin');
      const contactsJson = await getSetting('emergencyContacts');
      if (weight) setBodyWeight(weight);
      if (interval) setHydrationInterval(interval);
      if (contactsJson) {
        try {
          setContacts(JSON.parse(contactsJson));
        } catch {}
      }
    }
    load();
  }, []);

  async function save() {
    const w = parseFloat(bodyWeight);
    if (isNaN(w) || w < 80 || w > 350) {
      Alert.alert('Invalid weight', 'Body weight must be between 80 and 350 lbs');
      return;
    }
    await saveSetting('bodyWeightLbs', bodyWeight);
    await saveSetting('hydrationIntervalMin', hydrationInterval);
    await saveSetting('emergencyContacts', JSON.stringify(contacts));
    Alert.alert('Saved', 'Settings updated');
  }

  function updateContact(index: number, field: keyof EmergencyContact, value: string) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addContact() {
    setContacts((prev) => [...prev, { name: '', phone: '', relation: '' }]);
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile & Settings</Text>

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Contacts</Text>
        <Text style={styles.hint}>
          These contacts will be included in a pre-filled emergency message if you activate an SOS.
        </Text>
        {contacts.map((c, i) => (
          <View key={i} style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <Text style={styles.contactLabel}>Contact {i + 1}</Text>
              {contacts.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeContact(i)}
                  accessibilityLabel={`Remove contact ${i + 1}`}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            <Field
              label="Name"
              value={c.name}
              onChange={(v) => updateContact(i, 'name', v)}
              placeholder="Jane Smith"
              accessibilityLabel={`Emergency contact ${i + 1} name`}
            />
            <Field
              label="Phone"
              value={c.phone}
              onChange={(v) => updateContact(i, 'phone', v)}
              keyboardType="phone-pad"
              placeholder="+1 555-000-0000"
              accessibilityLabel={`Emergency contact ${i + 1} phone number`}
            />
            <Field
              label="Relationship"
              value={c.relation}
              onChange={(v) => updateContact(i, 'relation', v)}
              placeholder="Spouse, friend, etc."
              accessibilityLabel={`Emergency contact ${i + 1} relationship`}
            />
          </View>
        ))}
        <TouchableOpacity
          style={styles.addContactBtn}
          onPress={addContact}
          accessibilityLabel="Add another emergency contact"
        >
          <Text style={styles.addContactText}>+ Add Contact</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutText}>
            R2R2R Companion v1.0{'\n\n'}
            This app is an unofficial planning and safety aid for Rim to Rim to Rim crossings of
            the Grand Canyon. It does not replace official NPS guidance, ranger advice, or
            your own judgment.{'\n\n'}
            Always carry a satellite communicator. File a trip plan. Know when to turn back.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.saveBtn}
        onPress={save}
        accessibilityLabel="Save settings"
      >
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  placeholder,
  hint,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: any;
  placeholder?: string;
  hint?: string;
  accessibilityLabel?: string;
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
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#f1f5f9',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 44,
  },
  hint: { color: '#475569', fontSize: 12, marginTop: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#f1f5f9', fontSize: 26, fontWeight: '800', marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  hint: { color: '#64748b', fontSize: 13, marginBottom: 12 },
  contactCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  removeText: { color: '#ef4444', fontSize: 14 },
  addContactBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 44,
    justifyContent: 'center',
  },
  addContactText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  aboutCard: { backgroundColor: '#1e293b', borderRadius: 10, padding: 16 },
  aboutText: { color: '#64748b', fontSize: 14, lineHeight: 21 },
  saveBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
