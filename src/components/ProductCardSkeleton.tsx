import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius } from '../constants/theme';

export const ProductCardSkeleton: React.FC = React.memo(() => {
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
    <Animated.View style={[styles.card, { opacity }]}> 
      <View style={styles.image} />
      <View style={styles.lineLg} />
      <View style={styles.lineMd} />
      <View style={styles.lineSm} />
      <View style={styles.row}>
        <View style={styles.btn} />
        <View style={styles.btn} />
      </View>
    </Animated.View>
  );
});

ProductCardSkeleton.displayName = 'ProductCardSkeleton';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt
  },
  lineLg: {
    width: '90%',
    height: 14,
    borderRadius: 8,
    backgroundColor: '#E8EEF6'
  },
  lineMd: {
    width: '66%',
    height: 12,
    borderRadius: 8,
    backgroundColor: '#E8EEF6'
  },
  lineSm: {
    width: '42%',
    height: 12,
    borderRadius: 8,
    backgroundColor: '#E8EEF6'
  },
  row: {
    flexDirection: 'row',
    gap: 8
  },
  btn: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E8EEF6'
  }
});
