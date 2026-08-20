import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, shadows } from '../constants/theme';
import { ScreenContainer } from './ScreenContainer';

export const ProductDetailsSkeleton: React.FC = React.memo(() => {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true })
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <ScreenContainer scroll={false}>
      <Animated.View style={[styles.container, { opacity }]}>
        {/* HERO IMAGE SKELETON */}
        <View style={styles.imagePlaceholder} />

        {/* INFO CARD SKELETON */}
        <View style={styles.card}>
          {/* Category Badge & Pack Size */}
          <View style={styles.badgeRow}>
            <View style={styles.badgePill} />
            <View style={styles.packPill} />
          </View>

          {/* Title */}
          <View style={styles.titleLine1} />
          <View style={styles.titleLine2} />

          {/* Price Row */}
          <View style={styles.priceRow}>
            <View style={styles.pricePill} />
            <View style={styles.discountPill} />
          </View>

          {/* Tiered / MOQ Box */}
          <View style={styles.moqBox} />

          {/* Description Lines */}
          <View style={styles.descLine1} />
          <View style={styles.descLine2} />
          <View style={styles.descLine3} />
        </View>

        {/* BOTTOM ACTION BAR SKELETON */}
        <View style={styles.bottomBar}>
          <View style={styles.stepperPill} />
          <View style={styles.actionBtn} />
        </View>
      </Animated.View>
    </ScreenContainer>
  );
});

ProductDetailsSkeleton.displayName = 'ProductDetailsSkeleton';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 14
  },
  imagePlaceholder: {
    width: '100%',
    height: 240,
    borderRadius: radius.xl,
    backgroundColor: '#E2E8F0',
    ...shadows.card
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...shadows.card
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  badgePill: {
    width: 80,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: '#E2E8F0'
  },
  packPill: {
    width: 50,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: '#EEF2F6'
  },
  titleLine1: {
    width: '95%',
    height: 18,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  titleLine2: {
    width: '65%',
    height: 18,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4
  },
  pricePill: {
    width: 100,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  discountPill: {
    width: 60,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#DCFCE7'
  },
  moqBox: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  descLine1: {
    width: '100%',
    height: 12,
    borderRadius: 3,
    backgroundColor: '#EEF2F6',
    marginTop: 4
  },
  descLine2: {
    width: '90%',
    height: 12,
    borderRadius: 3,
    backgroundColor: '#EEF2F6'
  },
  descLine3: {
    width: '70%',
    height: 12,
    borderRadius: 3,
    backgroundColor: '#EEF2F6'
  },
  bottomBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.floating
  },
  stepperPill: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: '#E2E8F0'
  },
  actionBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: '#E2E8F0'
  }
});
