import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { colors, radius } from '../constants/theme';

const steps = [
  { key: 'processing', label: 'Processing', icon: 'clipboard-text-clock-outline' },
  { key: 'confirmed', label: 'Confirmed', icon: 'package-variant-closed' },
  { key: 'dispatched', label: 'Dispatched', icon: 'truck-fast-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'check-circle-outline' }
] as const;

const normalizeStatusIndex = (status: string): number => {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'delivered') return 3;
  if (s === 'dispatched' || s === 'shipped') return 2;
  if (s === 'confirmed' || s === 'packed') return 1;
  if (s === 'processing' || s === 'pending') return 0;
  return 0;
};

export const OrderStatusTimeline: React.FC<{
  status:
    | 'pending'
    | 'processing'
    | 'confirmed'
    | 'packed'
    | 'shipped'
    | 'dispatched'
    | 'delivered'
    | 'cancelled'
    | string;
}> = ({ status }) => {
  const normStatus = String(status || '').toLowerCase().trim();

  if (normStatus === 'cancelled') {
    return (
      <View style={styles.cancelledCard}>
        <View style={styles.cancelledHeader}>
          <Feather name="x-circle" size={18} color={colors.danger} />
          <Text style={styles.cancelledTitle}>Order Cancelled</Text>
        </View>
        <Text style={styles.cancelledText}>
          This wholesale order was cancelled. Please contact customer support if you need assistance.
        </Text>
      </View>
    );
  }

  const activeStepIndex = normalizeStatusIndex(normStatus);
  const isDelivered = normStatus === 'delivered';

  return (
    <View style={styles.container}>
      <View style={styles.progressTrack}>
        {/* Background track line */}
        <View style={styles.trackBackground} />
        {/* Active progress fill */}
        <View
          style={[
            styles.trackFill,
            {
              width:
                isDelivered
                  ? '100%'
                  : activeStepIndex === 0
                  ? '0%'
                  : activeStepIndex === 1
                  ? '33.3%'
                  : activeStepIndex === 2
                  ? '66.6%'
                  : '100%'
            }
          ]}
        />
      </View>

      <View style={styles.stepsRow}>
        {steps.map((step, index) => {
          const isCompleted = isDelivered || index < activeStepIndex;
          const isCurrent = !isDelivered && index === activeStepIndex;
          const isFuture = !isDelivered && index > activeStepIndex;

          return (
            <View key={step.key} style={styles.stepItem}>
              <View
                style={[
                  styles.node,
                  isCompleted && styles.nodeCompleted,
                  isCurrent && styles.nodeCurrent,
                  isFuture && styles.nodeFuture
                ]}
              >
                {isCompleted ? (
                  <Feather name="check" size={14} color={colors.white} />
                ) : isCurrent ? (
                  <View style={styles.currentInnerDot} />
                ) : (
                  <Text style={styles.futureIndexText}>{index + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  (isCompleted || isCurrent) && styles.stepLabelActive,
                  isCurrent && styles.stepLabelCurrent
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4
  },
  progressTrack: {
    position: 'absolute',
    top: 13,
    left: '12%',
    right: '12%',
    height: 3,
    justifyContent: 'center'
  },
  trackBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2
  },
  trackFill: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  stepItem: {
    width: '25%',
    alignItems: 'center'
  },
  node: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    zIndex: 2
  },
  nodeCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  nodeCurrent: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderWidth: 2.5
  },
  currentInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  nodeFuture: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border
  },
  futureIndexText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800'
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center'
  },
  stepLabelActive: {
    color: colors.text,
    fontWeight: '800'
  },
  stepLabelCurrent: {
    color: colors.primary,
    fontWeight: '900'
  },
  cancelledCard: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.md,
    padding: 12,
    gap: 4
  },
  cancelledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  cancelledTitle: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800'
  },
  cancelledText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16
  }
});
