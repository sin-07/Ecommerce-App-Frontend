import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../contexts/NetworkContext';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../constants/theme';

export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isOnline, hasCachedData } = useNetwork();
  const { colors } = useTheme();

  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowRestored(false);
      Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      }).start();
    } else if (wasOffline.current) {
      // Transition from offline to back online
      wasOffline.current = false;
      setShowRestored(true);

      const timer = setTimeout(() => {
        Animated.timing(anim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true
        }).start(() => {
          setShowRestored(false);
        });
      }, 2600);

      return () => clearTimeout(timer);
    }
  }, [isOnline, anim]);

  if (isOnline && !showRestored) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 0]
  });

  const isRestored = isOnline && showRestored;

  return (
    <Animated.View
      style={[
        styles.bannerWrap,
        {
          top: insets.top,
          transform: [{ translateY }],
          backgroundColor: isRestored ? '#065F46' : '#7F1D1D',
          borderColor: isRestored ? '#059669' : '#DC2626'
        }
      ]}
      pointerEvents="none"
    >
      <Feather
        name={isRestored ? 'check-circle' : 'wifi-off'}
        size={14}
        color="#FFFFFF"
        style={styles.icon}
      />
      <Text style={styles.bannerText}>
        {isRestored
          ? 'Back online'
          : hasCachedData
          ? "You're offline — showing cached data"
          : "You're offline"}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6
  },
  icon: {
    marginRight: 6
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2
  }
});
