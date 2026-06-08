import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../src/store/tripStore';
import { useStravaStore } from '../../src/store/stravaStore';
import type { FitnessLevel, TripDirection } from '../../src/lib/types';
import {
  generateScheduledSegments,
  calculateTargetFinishTime,
  parseStartTime,
  formatTime,
  ESTIMATED_HOURS,
} from '../../src/lib/pacing';

const FITNESS_LEVELS: FitnessLevel[] = ['BEGINNER', 'INTERMEDIATE', 'STRONG', 'ELITE'];
const FITNESS_LABELS: Record<FitnessLevel, string> = {
  BEGINNER: 'Beginner (~32h)',
  INTERMEDIATE: 'Intermediate (~26h)',
  STRONG: 'Strong (~21h)',
  ELITE: 'Elite (~18h)',
};

function generateId() {
  return `trip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseDateString(str: string): Date | null {
  // Accept YYYY-MM-DD
  const d = new Date(str + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function isFutureDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d >= today;
}

export default function SetupScreen() {
  const router = useRouter();
  const { saveTrip } = useTripStore();
  const { analysis } = useStravaStore();

  const [tripDate, setTripDate] = useState('');
  const [startTime, setStartTime] = useState('04:00');
  const [direction, setDirection] = useState<TripDirection>('S_TO_N');
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('STRONG');
  const [stravaApplied, setStravaApplied] = useState(false);
  const [bodyWeight, setBodyWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');

  // Pre-fill fitness level from Strava analysis the first time it's available
  useEffect(() => {
    if (analysis && !stravaApplied) {
      setFitnessLevel(analysis.suggestedLevel);
      setStravaApplied(true);
    }
  }, [analysis]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    const date = parseDateString(tripDate);
    if (!date) {
      newErrors.tripDate = 'Enter a valid date (YYYY-MM-DD)';
    } else if (!isFutureDate(date)) {
      newErrors.tripDate = 'Trip date must be today or in the future';
    }
    const weight = parseFloat(bodyWeight);
    if (!bodyWeight || isNaN(weight) || weight < 80 || weight > 350) {
      newErrors.bodyWeight = 'Enter your weight in lbs (80–350)';
    }
    const [h] = startTime.split(':').map(Number);
    if (isNaN(h) || h < 2 || h > 6) {
      newErrors.startTime = 'Start time must be between 2:00 and 6:00 (24h)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function startTimeWarning(): string | null {
    const [h] = startTime.split(':').map(Number);
    if (isNaN(h)) return null;
    if (h < 3 || h > 5) return 'Recommended: 3:00–5:00 AM start';
    return null;
  }

  function getPreview() {
    const date = parseDateString(tripDate);
    if (!date || !startTime || !bodyWeight) return null;
    try {
      const start = parseStartTime(date, startTime);
      const finish = calculateTargetFinishTime(fitnessLevel, start);
      return { start, finish };
    } catch {
      return null;
    }
  }

  async function handleCreate() {
    if (!validate()) return;
    const date = parseDateString(tripDate)!;
    const weight = parseFloat(bodyWeight);
    setSaveError('');
    setSubmitting(true);
    try {
      const startDate = parseStartTime(date, startTime);
      const segments = generateScheduledSegments(fitnessLevel, startDate, direction);
      const targetFinishTime = calculateTargetFinishTime(fitnessLevel, startDate);

      await saveTrip({
        id: generateId(),
        createdAt: new Date(),
        tripDate: date,
        startTime,
        direction,
        fitnessLevel,
        bodyWeightLbs: weight,
        targetFinishTime,
        status: 'PLANNED',
        scheduledSegments: segments,
        checkIns: [],
        hydrationLog: [],
        gearChecklist: [],
      });
      router.replace('/');
    } catch (e: any) {
      setSaveError(e?.message ?? 'Failed to save trip. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const preview = getPreview();
  const warning = startTimeWarning();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Plan Your R2R2R</Text>

      {/* Date */}
      <View style={styles.section}>
        <Text style={styles.label}>Trip Date</Text>
        <TextInput
          style={[styles.input, errors.tripDate ? styles.inputError : null]}
          value={tripDate}
          onChangeText={(v) => { setTripDate(v); setErrors((e) => ({ ...e, tripDate: '' })); }}
          placeholder="YYYY-MM-DD  e.g. 2025-10-01"
          placeholderTextColor="#475569"
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Trip date"
        />
        {errors.tripDate ? <Text style={styles.errorText}>{errors.tripDate}</Text> : null}
      </View>

      {/* Start time */}
      <View style={styles.section}>
        <Text style={styles.label}>Planned Start Time (24h)</Text>
        <TextInput
          style={[styles.input, errors.startTime ? styles.inputError : warning ? styles.inputWarn : null]}
          value={startTime}
          onChangeText={(v) => { setStartTime(v); setErrors((e) => ({ ...e, startTime: '' })); }}
          placeholder="04:00"
          placeholderTextColor="#475569"
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Planned start time"
        />
        {errors.startTime
          ? <Text style={styles.errorText}>{errors.startTime}</Text>
          : warning
          ? <Text style={styles.warnText}>{warning}</Text>
          : <Text style={styles.hint}>3:00–5:00 AM recommended to beat Inner Gorge heat</Text>}
      </View>

      {/* Direction */}
      <View style={styles.section}>
        <Text style={styles.label}>Starting Trailhead</Text>
        <View style={styles.toggleRow}>
          {(['S_TO_N', 'N_TO_S'] as TripDirection[]).map((dir) => (
            <TouchableOpacity
              key={dir}
              style={[styles.toggle, direction === dir && styles.toggleActive]}
              onPress={() => setDirection(dir)}
              accessibilityRole="radio"
              accessibilityState={{ selected: direction === dir }}
            >
              <Text style={[styles.toggleText, direction === dir && styles.toggleTextActive]}>
                {dir === 'S_TO_N' ? '↓ South Kaibab TH' : '↓ North Rim TH'}
              </Text>
              <Text style={[styles.toggleSub, direction === dir && styles.toggleSubActive]}>
                {dir === 'S_TO_N' ? 'Finish: Bright Angel TH' : 'Finish: South Rim'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Strava suggestion banner */}
      {analysis && (
        <View style={styles.stravaBanner}>
          <Text style={styles.stravaBannerTitle}>Strava suggests: {analysis.suggestedLevel.charAt(0) + analysis.suggestedLevel.slice(1).toLowerCase()}</Text>
          <Text style={styles.stravaBannerSub}>{analysis.reasoning}</Text>
          {fitnessLevel !== analysis.suggestedLevel && (
            <TouchableOpacity onPress={() => setFitnessLevel(analysis.suggestedLevel)}>
              <Text style={styles.stravaBannerApply}>Apply suggestion</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Fitness */}
      <View style={styles.section}>
        <Text style={styles.label}>Fitness Level</Text>
        {FITNESS_LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.fitnessOption, fitnessLevel === level && styles.fitnessOptionActive]}
            onPress={() => setFitnessLevel(level)}
            accessibilityRole="radio"
            accessibilityState={{ selected: fitnessLevel === level }}
          >
            <View style={[styles.radio, fitnessLevel === level && styles.radioActive]}>
              {fitnessLevel === level && <View style={styles.radioDot} />}
            </View>
            <View style={styles.fitnessContent}>
              <Text style={[styles.fitnessLabel, fitnessLevel === level && styles.fitnessLabelActive]}>
                {FITNESS_LABELS[level]}
              </Text>
              <Text style={styles.fitnessDesc}>
                {level === 'BEGINNER' && 'New to big canyon days, occasional hiking'}
                {level === 'INTERMEDIATE' && 'Regular long hikes, some canyon experience'}
                {level === 'STRONG' && 'Consistent training, multiple canyon trips'}
                {level === 'ELITE' && 'Ultra runner / elite mountain athlete'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Body weight */}
      <View style={styles.section}>
        <Text style={styles.label}>Body Weight (lbs)</Text>
        <TextInput
          style={[styles.input, errors.bodyWeight ? styles.inputError : null]}
          value={bodyWeight}
          onChangeText={(v) => { setBodyWeight(v); setErrors((e) => ({ ...e, bodyWeight: '' })); }}
          placeholder="e.g. 160"
          placeholderTextColor="#475569"
          keyboardType="numeric"
          accessibilityLabel="Body weight in pounds"
        />
        {errors.bodyWeight
          ? <Text style={styles.errorText}>{errors.bodyWeight}</Text>
          : <Text style={styles.hint}>Used to calculate your hourly hydration needs</Text>}
      </View>

      {/* Live preview */}
      {preview && (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Estimated Schedule</Text>
          <PreviewRow label="Depart South Kaibab TH" value={formatTime(preview.start)} />
          <PreviewRow label="Est. finish at Bright Angel TH" value={formatTime(preview.finish)} />
          <PreviewRow label="Total duration" value={`~${ESTIMATED_HOURS[fitnessLevel]}h`} />
        </View>
      )}

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

      <TouchableOpacity
        style={[styles.createBtn, submitting && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={submitting}
        accessibilityLabel="Create trip plan"
      >
        <Text style={styles.createBtnText}>
          {submitting ? 'Saving…' : 'Create Trip Plan →'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#f1f5f9', fontSize: 26, fontWeight: '800', marginBottom: 24 },
  section: { marginBottom: 22 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    color: '#f1f5f9',
    fontSize: 17,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 52,
  },
  inputError: { borderColor: '#ef4444' },
  inputWarn: { borderColor: '#f59e0b' },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 6 },
  warnText: { color: '#f59e0b', fontSize: 13, marginTop: 6 },
  hint: { color: '#475569', fontSize: 13, marginTop: 6 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    minHeight: 64,
    justifyContent: 'center',
  },
  toggleActive: { borderColor: '#3b82f6', backgroundColor: '#172033' },
  toggleText: { color: '#94a3b8', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  toggleTextActive: { color: '#93c5fd' },
  toggleSub: { color: '#475569', fontSize: 12, marginTop: 3, textAlign: 'center' },
  toggleSubActive: { color: '#60a5fa' },
  fitnessOption: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    minHeight: 56,
  },
  fitnessOptionActive: { borderColor: '#3b82f6', backgroundColor: '#172033' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#475569',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#3b82f6' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  fitnessContent: { flex: 1 },
  fitnessLabel: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  fitnessLabelActive: { color: '#93c5fd' },
  fitnessDesc: { color: '#64748b', fontSize: 13, marginTop: 2 },
  previewCard: {
    backgroundColor: '#172033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1d4ed8',
  },
  previewTitle: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  previewLabel: { color: '#64748b', fontSize: 14, flex: 1, marginRight: 8 },
  previewValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  stravaBanner: {
    backgroundColor: '#1a1200',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FC4C02',
  },
  stravaBannerTitle: { color: '#FC4C02', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  stravaBannerSub: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  stravaBannerApply: { color: '#FC4C02', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  saveError: { color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  createBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
