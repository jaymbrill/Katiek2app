import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useTripStore } from '../../src/store/tripStore';
import type { GearItem, GearTier } from '../../src/lib/types';
import gearItemsData from '../../src/constants/gearItems.json';

const WEIGHT_CAUTION_OZ = 320; // 20 lbs
const WEIGHT_WARNING_OZ = 400; // 25 lbs

export default function GearScreen() {
  const { trips, saveGearChecklist } = useTripStore();
  const activeOrPlanned = trips.find(
    (t) => t.status === 'PLANNED' || t.status === 'IN_PROGRESS'
  );

  const [gear, setGear] = useState<GearItem[]>(() =>
    (gearItemsData as any[]).map((g) => ({ ...g, packed: false }))
  );

  useEffect(() => {
    if (activeOrPlanned?.gearChecklist?.length) {
      setGear(activeOrPlanned.gearChecklist);
    }
  }, [activeOrPlanned?.id]);

  function togglePacked(id: string) {
    const item = gear.find((g) => g.id === id);
    if (item?.tier === 'REQUIRED') return; // cannot uncheck required items
    setGear((prev) =>
      prev.map((g) => (g.id === id ? { ...g, packed: !g.packed } : g))
    );
  }

  function updateWeight(id: string, value: string) {
    const oz = parseFloat(value);
    setGear((prev) =>
      prev.map((g) => (g.id === id ? { ...g, weightOz: isNaN(oz) ? undefined : oz } : g))
    );
  }

  function saveChanges() {
    if (activeOrPlanned) {
      saveGearChecklist(activeOrPlanned.id, gear);
    }
  }

  const totalWeightOz = gear
    .filter((g) => g.packed)
    .reduce((sum, g) => sum + (g.weightOz ?? 0), 0);

  const weightLbs = (totalWeightOz / 16).toFixed(1);
  const weightColor =
    totalWeightOz >= WEIGHT_WARNING_OZ
      ? '#ef4444'
      : totalWeightOz >= WEIGHT_CAUTION_OZ
      ? '#f59e0b'
      : '#22c55e';

  const tiers: GearTier[] = ['REQUIRED', 'STRONGLY_RECOMMENDED', 'OPTIONAL'];
  const tierLabels: Record<GearTier, string> = {
    REQUIRED: 'Required (cannot skip)',
    STRONGLY_RECOMMENDED: 'Strongly Recommended',
    OPTIONAL: 'Optional',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.weightBar}>
        <Text style={styles.weightLabel}>Pack Weight (packed items)</Text>
        <Text style={[styles.weightValue, { color: weightColor }]}>
          {weightLbs} lbs
        </Text>
        {totalWeightOz >= WEIGHT_WARNING_OZ && (
          <Text style={styles.weightWarn}>⚠ Very heavy — consider trimming</Text>
        )}
        {totalWeightOz >= WEIGHT_CAUTION_OZ && totalWeightOz < WEIGHT_WARNING_OZ && (
          <Text style={styles.weightCaution}>Consider reducing to under 20 lbs</Text>
        )}
      </View>

      {tiers.map((tier) => {
        const items = gear.filter((g) => g.tier === tier);
        if (items.length === 0) return null;
        return (
          <View key={tier} style={styles.section}>
            <Text style={styles.sectionTitle}>{tierLabels[tier]}</Text>
            {items.map((item) => (
              <GearRow
                key={item.id}
                item={item}
                onToggle={() => togglePacked(item.id)}
                onWeightChange={(v) => updateWeight(item.id, v)}
              />
            ))}
          </View>
        );
      })}

      {activeOrPlanned && (
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={saveChanges}
          accessibilityLabel="Save gear checklist"
        >
          <Text style={styles.saveBtnText}>Save Checklist</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function GearRow({
  item,
  onToggle,
  onWeightChange,
}: {
  item: GearItem;
  onToggle: () => void;
  onWeightChange: (v: string) => void;
}) {
  const isRequired = item.tier === 'REQUIRED';
  return (
    <TouchableOpacity
      style={[styles.row, item.packed && styles.rowPacked]}
      onPress={onToggle}
      disabled={isRequired}
      accessibilityLabel={`${item.name}, ${item.packed ? 'packed' : 'not packed'}, ${isRequired ? 'required item' : 'tap to toggle'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.packed }}
    >
      <View style={[styles.checkbox, item.packed && styles.checkboxChecked]}>
        {item.packed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.itemName, !item.packed && styles.itemNameMuted]}>
            {item.name}
          </Text>
          {isRequired && <View style={styles.requiredBadge}><Text style={styles.requiredText}>REQ</Text></View>}
        </View>
        {item.notes ? (
          <Text style={styles.itemNotes}>{item.notes}</Text>
        ) : null}
        <View style={styles.weightRow}>
          <Text style={styles.weightInputLabel}>oz:</Text>
          <TextInput
            style={styles.weightInput}
            value={item.weightOz?.toString() ?? ''}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor="#475569"
            accessibilityLabel={`Weight in ounces for ${item.name}`}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  weightBar: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  weightLabel: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  weightValue: { fontSize: 36, fontWeight: '800', marginVertical: 4 },
  weightWarn: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  weightCaution: { color: '#f59e0b', fontSize: 13 },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    alignItems: 'flex-start',
    minHeight: 44,
  },
  rowPacked: { opacity: 0.75, backgroundColor: '#162032' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  itemName: { color: '#f1f5f9', fontSize: 16, fontWeight: '500', flex: 1 },
  itemNameMuted: { color: '#94a3b8' },
  requiredBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  requiredText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  itemNotes: { color: '#64748b', fontSize: 13, marginBottom: 6 },
  weightRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  weightInputLabel: { color: '#64748b', fontSize: 13, marginRight: 4 },
  weightInput: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#f1f5f9',
    fontSize: 14,
    minWidth: 48,
    minHeight: 32,
  },
  saveBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
