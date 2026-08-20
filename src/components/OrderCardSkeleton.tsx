import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, shadows } from '../constants/theme';

export const OrderCardSkeleton: React.FC = React.memo(() => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true })
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <View style={styles.orderNumberLine} />
          <View style={styles.dateLine} />
        </View>
        <View style={styles.statusBadge} />
      </View>

      <View style={styles.divider} />

      {/* Buyer info row */}
      <View style={styles.buyerRow}>
        <View style={styles.avatar} />
        <View style={styles.buyerTextWrap}>
          <View style={styles.buyerNameLine} />
          <View style={styles.buyerSubLine} />
        </View>
      </View>

      {/* Ordered Items Preview */}
      <View style={styles.itemsBox}>
        <View style={styles.itemRow}>
          <View style={styles.thumb} />
          <View style={styles.itemInfo}>
            <View style={styles.itemTitleLine} />
            <View style={styles.itemQtyLine} />
          </View>
          <View style={styles.itemPriceLine} />
        </View>
      </View>

      {/* Payment summary breakdown */}
      <View style={styles.paymentBox}>
        <View style={styles.paymentRow}>
          <View style={styles.paymentLabelLine} />
          <View style={styles.paymentValLine} />
        </View>
        <View style={styles.paymentRow}>
          <View style={styles.paymentLabelLine} />
          <View style={styles.paymentValLine} />
        </View>
      </View>

      {/* Action button */}
      <View style={styles.actionBtn} />
    </Animated.View>
  );
});

OrderCardSkeleton.displayName = 'OrderCardSkeleton';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadows.card
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLeft: {
    gap: 6
  },
  orderNumberLine: {
    width: 120,
    height: 16,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  dateLine: {
    width: 90,
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: '#F1F5F9'
  },
  statusBadge: {
    width: 80,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: '#E2E8F0'
  },
  divider: {
    height: 1,
    backgroundColor: colors.border
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0'
  },
  buyerTextWrap: {
    flex: 1,
    gap: 5
  },
  buyerNameLine: {
    width: '60%',
    height: 14,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  buyerSubLine: {
    width: '40%',
    height: 11,
    borderRadius: radius.xs,
    backgroundColor: '#F1F5F9'
  },
  itemsBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: '#CBD5E1'
  },
  itemInfo: {
    flex: 1,
    gap: 5
  },
  itemTitleLine: {
    width: '70%',
    height: 13,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  itemQtyLine: {
    width: '45%',
    height: 11,
    borderRadius: radius.xs,
    backgroundColor: '#F1F5F9'
  },
  itemPriceLine: {
    width: 60,
    height: 14,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  paymentBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  paymentLabelLine: {
    width: 80,
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  paymentValLine: {
    width: 60,
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  actionBtn: {
    height: 42,
    borderRadius: radius.md,
    backgroundColor: '#E2E8F0'
  }
});
