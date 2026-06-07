import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ScheduledSegment } from '../lib/types';
import { formatTime, formatDuration } from '../lib/pacing';

interface Props {
  segment: ScheduledSegment;
  isActive?: boolean;
  isCompleted?: boolean;
}

export function SegmentCard({ segment, isActive = false, isCompleted = false }: Props) {
  const elevSign = segment.elevationChangeFt >= 0 ? '+' : '';
  const elevColor = segment.elevationChangeFt > 0 ? '#ef4444' : '#22c55e';

  return (
    <View style={[styles.card, isActive && styles.active, isCompleted && styles.completed]}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>
          {segment.name}
        </Text>
        {isActive && <View style={styles.activeDot} />}
        {isCompleted && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.row}>
        <Stat label="Distance" value={`${segment.miles} mi`} />
        <Stat
          label="Elevation"
          value={`${elevSign}${segment.elevationChangeFt.toLocaleString()} ft`}
          color={elevColor}
        />
        <Stat label="Est. Time" value={formatDuration(segment.adjustedTimeMinutes)} />
      </View>
      <View style={styles.times}>
        <Text style={styles.timeText}>
          {formatTime(segment.plannedStartTime)} → {formatTime(segment.plannedEndTime)}
        </Text>
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#334155',
  },
  active: {
    borderLeftColor: '#3b82f6',
    backgroundColor: '#172033',
  },
  completed: {
    borderLeftColor: '#22c55e',
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  name: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
    marginTop: 4,
  },
  checkmark: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  times: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  timeText: {
    color: '#64748b',
    fontSize: 13,
  },
});
