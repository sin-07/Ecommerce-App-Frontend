import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, shadows } from '../constants/theme';

export const AdminDashboardSkeleton: React.FC = React.memo(() => {
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
    <Animated.View style={[styles.container, { opacity }]}>
      {/* SECTION TITLE PLACEHOLDER */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleLine} />
        <View style={styles.subtitleLine} />
      </View>

      {/* METRICS 2x2 GRID PLACEHOLDER */}
      <View style={styles.statsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.statCard}>
            <View style={styles.statIcon} />
            <View style={styles.statValue} />
            <View style={styles.statLabel} />
          </View>
        ))}
      </View>

      {/* QUICK ACTIONS ROW PLACEHOLDER */}
      <View style={styles.quickActions}>
        <View style={styles.actionBtn} />
        <View style={styles.actionBtn} />
      </View>

      {/* RECENT ORDERS HEADER */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleLine} />
        <View style={styles.subtitleLine} />
      </View>

      {/* RECENT ORDERS PLACEHOLDERS */}
      <View style={styles.orderList}>
        {[1, 2].map((i) => (
          <View key={i} style={styles.orderCard}>
            <View style={styles.orderTopRow}>
              <View style={styles.orderIdLine} />
              <View style={styles.orderBadge} />
            </View>
            <View style={styles.orderDetailRow}>
              <View style={styles.orderThumb} />
              <View style={styles.orderCopy}>
                <View style={styles.orderTextLg} />
                <View style={styles.orderTextSm} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

AdminDashboardSkeleton.displayName = 'AdminDashboardSkeleton';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 18
  },
  sectionHeader: {
    gap: 6
  },
  titleLine: {
    width: 180,
    height: 18,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  subtitleLine: {
    width: 240,
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: '#F1F5F9'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...shadows.card
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: '#E2E8F0'
  },
  statValue: {
    width: 90,
    height: 22,
    borderRadius: radius.xs,
    backgroundColor: '#CBD5E1'
  },
  statLabel: {
    width: 110,
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#E2E8F0'
  },
  orderList: {
    gap: 12
  },
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...shadows.card
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  orderIdLine: {
    width: 110,
    height: 14,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  orderBadge: {
    width: 70,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: '#E2E8F0'
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  orderThumb: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: '#CBD5E1'
  },
  orderCopy: {
    flex: 1,
    gap: 5
  },
  orderTextLg: {
    width: '75%',
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: '#E2E8F0'
  },
  orderTextSm: {
    width: '45%',
    height: 10,
    borderRadius: radius.xs,
    backgroundColor: '#F1F5F9'
  }
});
