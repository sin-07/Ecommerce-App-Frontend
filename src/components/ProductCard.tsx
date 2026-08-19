import React from 'react';
import { Image, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Product } from '../constants/types';
import { API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { getStockLabel, getStockTone, getStockStatus } from '../utils/stock';

type Props = {
  product: Product;
  onView?: () => void;
  onIncrementCart?: () => void;
  onDecrementCart?: () => void;
  onOpenCart?: () => void;
  cartCount?: number;
  compact?: boolean;
};

const ProductCardBase: React.FC<Props> = ({
  product,
  onView,
  onIncrementCart,
  onDecrementCart,
  onOpenCart,
  cartCount = 0,
  compact
}) => {
  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [cartCount]);

  const imageUri = product.imageUrl
    ? product.imageUrl.startsWith('http')
      ? product.imageUrl
      : `${API_BASE_URL.replace('/api', '')}${product.imageUrl}`
    : '';

  const stockStatus = getStockStatus(product.stock);
  const stockTone = getStockTone(product.stock);
  const isOutOfStock = stockStatus === 'out_of_stock';
  const isLowStock = stockStatus === 'low_stock';
  const moq = Math.max(1, product.minOrderQuantity || 1);

  return (
    <View style={[styles.card, compact && styles.compact]}>
      {/* THUMBNAIL WRAPPER */}
      <Pressable
        onPress={onView}
        disabled={!onView}
        style={({ pressed }) => [styles.imageWrap, pressed && styles.pressed]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.image, isOutOfStock && styles.imageMuted]}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imageFallback}>
            <MaterialCommunityIcons name="bottle-soda-classic-outline" size={38} color={colors.primary} />
          </View>
        )}
        <View
          style={[
            styles.stockBadge,
            { backgroundColor: stockTone.backgroundColor, borderColor: stockTone.borderColor }
          ]}
        >
          <Feather
            name={isOutOfStock ? 'x-circle' : isLowStock ? 'alert-circle' : 'check-circle'}
            size={11}
            color={stockTone.iconColor}
          />
          <Text style={[styles.stockBadgeText, { color: stockTone.textColor }]}>
            {isOutOfStock ? 'Out of stock' : isLowStock ? 'Low stock' : 'In stock'}
          </Text>
        </View>
      </Pressable>

      {/* BEVERAGE CATEGORY */}
      <View style={styles.categoryRow}>
        <Text style={styles.category}>{product.category || 'Soft Drinks'}</Text>
      </View>

      {/* TITLE & DESCRIPTION */}
      <Text style={styles.title} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {product.description || 'Wholesale beverage case for retail and foodservice.'}
      </Text>

      {/* PRICING & MOQ */}
      <View style={styles.priceRow}>
        <Text style={styles.price}>${product.price.toFixed(2)}</Text>
        <Text style={styles.unit}>/ case</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.moqPill}>
          <Text style={styles.moqText}>MOQ {moq} cases</Text>
        </View>
        <Text style={[styles.stock, isOutOfStock && styles.stockOut]}>
          {getStockLabel(product.stock)}
        </Text>
      </View>

      {/* CART ACTIONS */}
      {onIncrementCart ? (
        <View style={styles.actionsWrap}>
          {cartCount > 0 ? (
            <View style={styles.stepperWrap}>
              <Pressable
                onPress={onDecrementCart}
                style={styles.stepperButton}
                hitSlop={6}
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={16} color={colors.primary} />
              </Pressable>
              <Text style={styles.stepperCount}>{cartCount} in cart</Text>
              <Pressable
                onPress={onIncrementCart}
                disabled={isOutOfStock}
                style={[styles.stepperButton, isOutOfStock && styles.disabled]}
                hitSlop={6}
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.topActionsRow}>
              {onView ? (
                <Pressable
                  onPress={onView}
                  style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}
                >
                  <Text style={styles.viewButtonText}>Specs</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onIncrementCart}
                disabled={isOutOfStock}
                style={({ pressed }) => [
                  styles.addButton,
                  isOutOfStock && styles.disabled,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons name="cart-outline" size={15} color={colors.white} />
                <Text style={styles.addButtonText}>Add Case</Text>
              </Pressable>
            </View>
          )}

          {onOpenCart && cartCount > 0 ? (
            <Pressable onPress={onOpenCart} style={styles.goCartButton}>
              <Ionicons name="bag-handle-outline" size={14} color={colors.primaryPressed} />
              <Text style={styles.goCartText}>View Cart</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export const ProductCard = React.memo(ProductCardBase);
ProductCard.displayName = 'ProductCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 7,
    ...shadows.card
  },
  compact: {
    padding: 11
  },
  imageWrap: {
    position: 'relative'
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt
  },
  imageFallback: {
    width: '100%',
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  imageMuted: {
    opacity: 0.55
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  categoryRow: {
    marginTop: 2
  },
  category: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  title: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900'
  },
  description: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    minHeight: 34
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2
  },
  price: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900'
  },
  unit: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: 3
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4
  },
  moqPill: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  moqText: {
    color: colors.primaryPressed,
    fontSize: 10.5,
    fontWeight: '800'
  },
  stock: {
    color: colors.success,
    fontSize: 10.5,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right'
  },
  stockOut: {
    color: colors.danger
  },
  actionsWrap: {
    gap: 6,
    marginTop: 4
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 6
  },
  viewButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800'
  },
  addButton: {
    flex: 1.4,
    minHeight: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5
  },
  addButtonText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: '800'
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    backgroundColor: colors.infoSurface,
    padding: 3
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  stepperCount: {
    color: colors.primaryPressed,
    fontSize: 12.5,
    fontWeight: '800'
  },
  goCartButton: {
    minHeight: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4
  },
  goCartText: {
    color: colors.primaryPressed,
    fontSize: 11.5,
    fontWeight: '800'
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }]
  }
});
