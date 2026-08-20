import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Product } from '../constants/types';
import { colors, radius, shadows } from '../constants/theme';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';

type Props = {
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  badgeTone?: { text: string; bg: string; border: string };
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  items: Product[];
  loading?: boolean;
  onViewProduct: (product: Product) => void;
  onIncrementCart: (product: Product) => void;
  onDecrementCart: (product: Product) => void;
  getCartQuantity: (productId: string) => number;
  onRequireAuth?: (action: 'cart' | 'wishlist', product: Product, quantity?: number) => void;
  onSeeAll?: () => void;
};

export const HorizontalProductSection: React.FC<Props> = React.memo(({
  title,
  subtitle,
  badgeLabel,
  badgeTone = { text: colors.primary, bg: colors.primaryLight, border: '#DBEAFE' },
  icon,
  items,
  loading = false,
  onViewProduct,
  onIncrementCart,
  onDecrementCart,
  getCartQuantity,
  onRequireAuth,
  onSeeAll
}) => {
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <View style={styles.sectionContainer}>
      {/* SECTION HEADER */}
      <View style={styles.headerRow}>
        <View style={styles.titleArea}>
          <View style={styles.titleBadgeRow}>
            {icon ? (
              <View style={[styles.iconCircle, { backgroundColor: badgeTone.bg }]}>
                <MaterialCommunityIcons name={icon} size={16} color={badgeTone.text} />
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>{title}</Text>
            {badgeLabel ? (
              <View style={[styles.badge, { backgroundColor: badgeTone.bg, borderColor: badgeTone.border }]}>
                <Text style={[styles.badgeText, { color: badgeTone.text }]}>{badgeLabel}</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>

        {onSeeAll ? (
          <Pressable
            style={({ pressed }) => [styles.seeAllBtn, pressed && styles.pressed]}
            onPress={onSeeAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`See all ${title}`}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {/* HORIZONTAL PRODUCT SCROLL */}
      {loading && items.length === 0 ? (
        <View style={styles.skeletonRow}>
          {[1, 2, 3].map((key) => (
            <View key={key} style={styles.cardWrapper}>
              <ProductCardSkeleton compact />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard
                product={item}
                compact
                cartCount={getCartQuantity(item._id)}
                onView={() => onViewProduct(item)}
                onIncrementCart={() => onIncrementCart(item)}
                onDecrementCart={() => onDecrementCart(item)}
                onRequireAuth={onRequireAuth}
              />
            </View>
          )}
        />
      )}
    </View>
  );
});

HorizontalProductSection.displayName = 'HorizontalProductSection';

const styles = StyleSheet.create({
  sectionContainer: {
    marginVertical: 10
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2
  },
  titleArea: {
    flex: 1,
    gap: 2
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.navy,
    letterSpacing: -0.2
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.primary
  },
  pressed: {
    opacity: 0.75
  },
  listContent: {
    gap: 12,
    paddingRight: 16
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12
  },
  cardWrapper: {
    width: 185
  }
});
