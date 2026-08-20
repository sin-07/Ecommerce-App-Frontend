import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

export type CategoryCardData = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
  bgLight: string;
  borderLight: string;
  pillText: string;
};

const CATEGORIES_DATA: CategoryCardData[] = [
  {
    id: 'eggs',
    category: 'Eggs',
    title: 'EGGS',
    subtitle: 'Farm Fresh Eggs',
    description: 'Grade-A table eggs & brown eggs in commercial bulk trays',
    icon: 'egg-outline',
    accent: '#D97706',
    bgLight: '#FFFBEB',
    borderLight: '#FDE68A',
    pillText: '100% FARM FRESH'
  },
  {
    id: 'beverages',
    category: 'Beverages',
    title: 'BEVERAGES',
    subtitle: 'Chilled & Packaged Beverages',
    description: 'Direct factory soda crates, packaged juices & energy drinks',
    icon: 'cup-water',
    accent: '#0284C7',
    bgLight: '#F0F9FF',
    borderLight: '#BAE6FD',
    pillText: 'DIRECT FACTORY'
  },
  {
    id: 'wholesale',
    category: 'Existing Products',
    title: 'WHOLESALE',
    subtitle: 'Business Supplies',
    description: 'Commercial supplies, store essentials & bulk commodity stock',
    icon: 'cube-outline',
    accent: '#1D4ED8',
    bgLight: '#EFF6FF',
    borderLight: '#BFDBFE',
    pillText: 'COMMERCIAL RATES'
  }
];

type Props = {
  onSelectCategory: (category: string) => void;
};

export const CategoryShopCards: React.FC<Props> = React.memo(({ onSelectCategory }) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
          <Text style={styles.sectionSubtitle}>Select a primary wholesale vertical to browse supplies</Text>
        </View>
      </View>

      <View style={styles.cardsList}>
        {CATEGORIES_DATA.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onSelectCategory(item.category)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: item.bgLight, borderColor: item.borderLight },
              pressed && styles.pressed
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title} - ${item.subtitle}`}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconWrap, { backgroundColor: item.accent }]}>
                <MaterialCommunityIcons name={item.icon} size={24} color={colors.white} />
              </View>
              <View style={[styles.pillBadge, { borderColor: item.accent }]}>
                <Text style={[styles.pillText, { color: item.accent }]}>{item.pillText}</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={[styles.exploreText, { color: item.accent }]}>Explore {item.title}</Text>
              <View style={[styles.arrowCircle, { backgroundColor: item.accent }]}>
                <Ionicons name="arrow-forward" size={13} color={colors.white} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

CategoryShopCards.displayName = 'CategoryShopCards';

const styles = StyleSheet.create({
  container: {
    marginVertical: 14
  },
  headerRow: {
    marginBottom: 12,
    paddingHorizontal: 2
  },
  titleWrap: {
    gap: 2
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: -0.2
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary
  },
  cardsList: {
    gap: 12
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.2,
    padding: 16,
    ...shadows.sm
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }]
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm
  },
  pillBadge: {
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.85)'
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  cardContent: {
    marginBottom: 12,
    gap: 2
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: 0.4
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)'
  },
  exploreText: {
    fontSize: 13,
    fontWeight: '800'
  },
  arrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
