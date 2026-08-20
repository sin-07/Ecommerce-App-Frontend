import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

type Props = {
  onPress: () => void;
};

export const WholesaleCTACard: React.FC<Props> = React.memo(({ onPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.ambientGlow} />

        <View style={styles.content}>
          <View style={styles.badgeRow}>
            <View style={styles.tag}>
              <MaterialCommunityIcons name="shield-check-outline" size={13} color="#38BDF8" />
              <Text style={styles.tagText}>VERIFIED WHOLESALE SUPPLY</Text>
            </View>
          </View>

          <Text style={styles.title}>READY TO STOCK UP?</Text>
          <Text style={styles.subtitle}>
            Source commercial supplies, farm-fresh eggs & chilled beverages for your business with guaranteed logistics and tiered commercial rates.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Browse Wholesale Catalog"
          >
            <Text style={styles.actionButtonText}>Browse Wholesale Catalog</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.navy} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

WholesaleCTACard.displayName = 'WholesaleCTACard';

const styles = StyleSheet.create({
  container: {
    marginVertical: 16
  },
  card: {
    backgroundColor: '#0B1220',
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    position: 'relative',
    overflow: 'hidden',
    ...shadows.card
  },
  ambientGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    opacity: 0.15
  },
  content: {
    gap: 8,
    zIndex: 2
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 2
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)'
  },
  tagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.2
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#94A3B8',
    marginBottom: 8
  },
  actionButton: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    ...shadows.sm
  },
  actionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }]
  },
  actionButtonText: {
    color: colors.navy,
    fontSize: 13.5,
    fontWeight: '800'
  }
});
