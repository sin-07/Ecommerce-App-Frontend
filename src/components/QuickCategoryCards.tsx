import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

export type QuickCategoryItem = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
  bgLight: string;
  borderLight: string;
};

const CATEGORY_ITEMS: QuickCategoryItem[] = [
  {
    id: 'eggs',
    category: 'Eggs',
    title: 'FARM FRESH EGGS',
    subtitle: 'Fresh eggs for retailers, restaurants and distributors',
    buttonLabel: 'View Eggs',
    icon: 'egg-outline',
    accent: '#D97706',
    bgLight: '#FFFBEB',
    borderLight: '#FDE68A'
  },
  {
    id: 'beverages',
    category: 'Beverages',
    title: 'CHILLED BEVERAGES',
    subtitle: 'Bulk beverage supply for commercial buyers',
    buttonLabel: 'View Beverages',
    icon: 'cup-water',
    accent: '#0284C7',
    bgLight: '#F0F9FF',
    borderLight: '#BAE6FD'
  },
  {
    id: 'wholesale',
    category: 'Existing Products',
    title: 'WHOLESALE SUPPLIES',
    subtitle: 'Commercial products for business requirements',
    buttonLabel: 'View Wholesale',
    icon: 'cube-outline',
    accent: '#1D4ED8',
    bgLight: '#EFF6FF',
    borderLight: '#BFDBFE'
  }
];

type Props = {
  onSelectCategory: (category: string) => void;
  activeCategory?: string;
};

export const QuickCategoryCards: React.FC<Props> = React.memo(({ onSelectCategory, activeCategory }) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.sectionTitle}>Wholesale Verticals</Text>
          <Text style={styles.sectionSubtitle}>Direct supply chains across essential trade categories</Text>
        </View>
      </View>

      <View style={styles.cardsGrid}>
        {CATEGORY_ITEMS.map((item) => {
          const isActive = activeCategory === item.category;

          return (
            <Pressable
              key={item.id}
              onPress={() => onSelectCategory(item.category)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: item.bgLight, borderColor: isActive ? item.accent : item.borderLight },
                isActive && styles.activeCard,
                pressed && styles.pressed
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} - ${item.subtitle}`}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: item.accent }]}>
                  <MaterialCommunityIcons name={item.icon} size={22} color={colors.white} />
                </View>
                <View style={[styles.statusPill, { borderColor: item.accent }]}>
                  <Text style={[styles.statusPillText, { color: item.accent }]}>TRADE SUPPLY</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={[styles.actionText, { color: item.accent }]}>{item.buttonLabel}</Text>
                <Ionicons name="arrow-forward" size={15} color={item.accent} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

QuickCategoryCards.displayName = 'QuickCategoryCards';

const styles = StyleSheet.create({
  container: {
    marginVertical: 12
  },
  headerRow: {
    marginBottom: 10,
    paddingHorizontal: 2
  },
  titleWrap: {
    gap: 2
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.navy,
    letterSpacing: -0.2
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary
  },
  cardsGrid: {
    gap: 10
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.2,
    padding: 14,
    ...shadows.sm
  },
  activeCard: {
    borderWidth: 2,
    ...shadows.card
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }]
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm
  },
  statusPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.7)'
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  cardBody: {
    marginBottom: 12,
    gap: 4
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.navy,
    letterSpacing: 0.2
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800'
  }
});
