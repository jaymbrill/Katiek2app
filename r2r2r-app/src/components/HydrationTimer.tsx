import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  onLog: (waterOz: number, hadElectrolytes: boolean) => void;
  intervalMinutes?: number;
}

export function HydrationTimer({ onLog, intervalMinutes = 30 }: Props) {
  const [minutesSinceLast, setMinutesSinceLast] = useState(0);
  const [lastLogTime, setLastLogTime] = useState<Date | null>(null);
  const [nextElectrolytes, setNextElectrolytes] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastLogTime) {
        const elapsed = Math.floor((Date.now() - lastLogTime.getTime()) / 60000);
        setMinutesSinceLast(elapsed);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [lastLogTime]);

  const isOverdue = minutesSinceLast >= intervalMinutes;

  function handleLog(includeElectrolytes: boolean) {
    onLog(16, includeElectrolytes);
    setLastLogTime(new Date());
    setMinutesSinceLast(0);
    setNextElectrolytes(!includeElectrolytes);
  }

  return (
    <View style={[styles.container, isOverdue && styles.overdue]}>
      <Text style={styles.title}>Hydration</Text>
      {lastLogTime ? (
        <Text style={[styles.elapsed, isOverdue && styles.elapsedOverdue]}>
          {minutesSinceLast}m ago
          {isOverdue ? ' — DRINK NOW' : ''}
        </Text>
      ) : (
        <Text style={styles.elapsed}>Not started</Text>
      )}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => handleLog(false)}
          accessibilityLabel="Log 16 oz water"
        >
          <Text style={styles.btnText}>💧 16 oz</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnElectrolyte]}
          onPress={() => handleLog(true)}
          accessibilityLabel="Log 16 oz water with electrolytes"
        >
          <Text style={styles.btnText}>💧 + ⚡ Electrolytes</Text>
        </TouchableOpacity>
      </View>
      {nextElectrolytes && (
        <Text style={styles.hint}>Next: include electrolytes</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#334155',
  },
  overdue: {
    borderColor: '#ef4444',
    backgroundColor: '#1a1010',
  },
  title: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  elapsed: {
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  elapsedOverdue: {
    color: '#ef4444',
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  btnElectrolyte: {
    backgroundColor: '#7c3aed',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  hint: {
    color: '#7c3aed',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});
