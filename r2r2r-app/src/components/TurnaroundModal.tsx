import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import type { TurnaroundAssessment } from '../lib/types';

interface Props {
  visible: boolean;
  assessment: TurnaroundAssessment;
  onDismiss: () => void;
  onOverride: () => void;
}

export function TurnaroundModal({ visible, assessment, onDismiss, onOverride }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  const isEmergency = assessment.recommendation === 'TURN_BACK_NOW';
  const canOverride = confirmText.toLowerCase() === 'i understand';

  function startHold() {
    let progress = 0;
    holdTimer.current = setInterval(() => {
      progress += 100 / 30; // 3 seconds at 100ms intervals
      setHoldProgress(Math.min(progress, 100));
      if (progress >= 100) {
        stopHold();
        handleOverride();
      }
    }, 100);
  }

  function stopHold() {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    if (holdProgress < 100) setHoldProgress(0);
  }

  function handleOverride() {
    setConfirmText('');
    setHoldProgress(0);
    onOverride();
  }

  const bgColor = isEmergency ? '#7f1d1d' : '#78350f';

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Text style={styles.icon}>{isEmergency ? '🔴' : '⚠️'}</Text>
        <Text style={styles.title}>
          {isEmergency ? 'TURN BACK NOW' : 'CONSIDER TURNING BACK'}
        </Text>
        <Text style={styles.reasoning}>{assessment.reasoning}</Text>

        <View style={styles.stats}>
          <Stat
            label="Behind schedule"
            value={`${assessment.minutesBehindPlan} min`}
          />
          <Stat
            label="Projected finish"
            value={formatTime(assessment.estimatedFinishTime)}
          />
          <Stat
            label="Latest safe turnaround"
            value={formatTime(assessment.latestSafeTurnaroundTime)}
          />
        </View>

        <TouchableOpacity
          style={styles.turnBackBtn}
          onPress={onDismiss}
          accessibilityLabel="I will turn back now"
        >
          <Text style={styles.turnBackText}>↩ I WILL TURN BACK</Text>
        </TouchableOpacity>

        <View style={styles.overrideSection}>
          <Text style={styles.overrideLabel}>
            Override (not recommended) — type "I understand" then hold the button
          </Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="I understand"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            accessibilityLabel="Type I understand to enable override"
          />
          {canOverride && (
            <View style={styles.holdWrapper}>
              <Pressable
                onPressIn={startHold}
                onPressOut={stopHold}
                style={styles.holdBtn}
                accessibilityLabel="Hold 3 seconds to override safety recommendation"
              >
                <View
                  style={[
                    styles.holdProgress,
                    { width: `${holdProgress}%` as any },
                  ]}
                />
                <Text style={styles.holdText}>
                  {holdProgress > 0 ? 'Keep holding…' : 'HOLD TO OVERRIDE (3s)'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 16,
  },
  reasoning: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
  },
  stats: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  turnBackBtn: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
    minHeight: 56,
    justifyContent: 'center',
  },
  turnBackText: {
    color: '#7f1d1d',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  overrideSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
  },
  overrideLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
    minHeight: 44,
  },
  holdWrapper: {
    width: '100%',
  },
  holdBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 44,
  },
  holdProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  holdText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 14,
    zIndex: 1,
  },
});
