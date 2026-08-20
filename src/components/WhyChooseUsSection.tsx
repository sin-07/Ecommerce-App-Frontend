import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

type BenefitItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
  bgLight: string;
};

const BENEFITS: BenefitItem[] = [
  {
    id: 'direct',
    title: 'Direct Wholesale Supply',
    description: 'Farm-fresh table eggs and direct beverage factory supplies.',
    icon: 'factory',
    accent: '#1D4ED8',
    bgLight: '#EFF6FF'
  },
  {
    id: 'pricing',
    title: 'Competitive Bulk Pricing',
    description: 'Tiered commercial rates designed for maximum retailer margins.',
    icon: 'tag-multiple-outline',
    accent: '#D97706',
    bgLight: '#FFFBEB'
  },
  {
    id: 'dispatch',
    title: 'Fast Dispatch',
    description: 'Rapid fulfillment and scheduled same-day delivery on qualifying orders.',
    icon: 'truck-delivery-outline',
    accent: '#0284C7',
    bgLight: '#F0F9FF'
  },
  {
    id: 'support',
    title: 'Business Support',
    description: 'Dedicated trade account support, automated invoicing, and hassle-free reorders.',
    icon: 'headset',
    accent: '#10B981',
    bgLight: '#ECFDF5'
  }
];

export const WhyChooseUsSection: React.FC = React.memo(() => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleBadgeRow}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>Why AP Enterprises</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Trusted commercial partner for grocery stores, restaurants, and retail distributors
        </Text>
      </View>

      <View style={styles.grid}>
        {BENEFITS.map((item) => (
          <View key={item.id} style={styles.benefitCard}>
            <View style={[styles.iconWrap, { backgroundColor: item.bgLight }]}>
              <MaterialCommunityIcons name={item.icon} size={22} color={item.accent} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

WhyChooseUsSection.displayName = 'WhyChooseUsSection';

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm
  },
  headerRow: {
    marginBottom: 14
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.navy,
    letterSpacing: -0.2
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary
  },
  grid: {
    gap: 10
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textWrap: {
    flex: 1,
    gap: 2
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.navy
  },
  cardDesc: {
    fontSize: 11.5,
    lineHeight: 15.5,
    color: colors.textSecondary
  }
});
