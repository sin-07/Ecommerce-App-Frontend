import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';

const logoSource = require('../../assets/Ap-Enterprises.jpeg');

export const SplashScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brandWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.logoCircle}>
          <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
        </View>
        <Text style={styles.title}>AP Enterprises</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PREMIUM B2B BEVERAGE SUPPLY</Text>
        </View>
        <Text style={styles.subtitle}>Direct Wholesale Beverage Procurement</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  brandWrap: {
    alignItems: 'center',
    gap: 10
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10
  },
  logoImage: {
    width: '100%',
    height: '100%'
  },
  title: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  badgeText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center'
  }
});
