import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, shadows } from '../constants/theme';
import { CARD_IMAGE_HEIGHT, CARD_TOTAL_HEIGHT } from './ProductCard';

export const ProductCardSkeleton: React.FC<{ compact?: boolean }> = React.memo(({ compact }) => {
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
    <Animated.View style={[styles.card, compact && styles.compact, { opacity }]}>
      {/* 1. FIXED IMAGE CONTAINER SKELETON */}
      <View style={styles.image} />

      {/* 2. BODY CONTENT SKELETON WITH IDENTICAL SLOTS */}
      <View style={styles.bodyContent}>
        {/* Category Row */}
        <View style={styles.categoryRow}>
          <View style={styles.catBadge} />
          <View style={styles.packSize} />
        </View>

        {/* Title Area */}
        <View style={styles.titleWrap}>
          <View style={styles.titleLine1} />
          <View style={styles.titleLine2} />
        </View>

        {/* Description Area */}
        <View style={styles.descriptionWrap}>
          <View style={styles.descLine1} />
          <View style={styles.descLine2} />
        </View>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <View style={styles.pricePill} />
        </View>

        {/* Meta Row */}
        <View style={styles.metaRow}>
          <View style={styles.moqPill} />
          <View style={styles.stockPill} />
        </View>
      </View>

      {/* 3. ACTION BUTTONS SKELETON */}
      <View style={styles.actionsWrap}>
        <View style={styles.btn1} />
        <View style={styles.btn2} />
      </View>
    </Animated.View>
  );
});

ProductCardSkeleton.displayName = 'ProductCardSkeleton';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    height: CARD_TOTAL_HEIGHT,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadows.card
  },
  compact: {
    padding: 10
  },
  image: {
    height: CARD_IMAGE_HEIGHT,
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: '#E2E8F0'
  },
  bodyContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 6
  },
  categoryRow: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  catBadge: {
    width: 60,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: '#E2E8F0'
  },
  packSize: {
    width: 35,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  titleWrap: {
    height: 38,
    justifyContent: 'center',
    gap: 4
  },
  titleLine1: {
    width: '90%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  titleLine2: {
    width: '60%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  descriptionWrap: {
    height: 30,
    justifyContent: 'center',
    gap: 3
  },
  descLine1: {
    width: '95%',
    height: 10,
    borderRadius: 3,
    backgroundColor: '#EEF2F6'
  },
  descLine2: {
    width: '75%',
    height: 10,
    borderRadius: 3,
    backgroundColor: '#EEF2F6'
  },
  priceRow: {
    height: 24,
    justifyContent: 'center'
  },
  pricePill: {
    width: 70,
    height: 15,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  metaRow: {
    height: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  moqPill: {
    width: 55,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: '#EEF2F6'
  },
  stockPill: {
    width: 45,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#EEF2F6'
  },
  actionsWrap: {
    height: 38,
    marginTop: 6,
    flexDirection: 'row',
    gap: 6
  },
  btn1: {
    flex: 1,
    height: '100%',
    borderRadius: radius.sm,
    backgroundColor: '#E2E8F0'
  },
  btn2: {
    flex: 1.4,
    height: '100%',
    borderRadius: radius.sm,
    backgroundColor: '#E2E8F0'
  }
});
