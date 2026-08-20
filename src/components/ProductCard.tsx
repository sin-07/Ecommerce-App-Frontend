import React from 'react';
import { ActivityIndicator, Image, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Product } from '../constants/types';
import { API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { getStockLabel, getStockTone, getStockStatus } from '../utils/stock';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { toggleWishlist } from '../redux/slices/wishlistSlice';
import { formatINR } from '../utils/currency';
import { toast } from '../utils/toast';

type Props = {
  product: Product;
  onView?: () => void;
  onIncrementCart?: () => void;
  onDecrementCart?: () => void;
  onOpenCart?: () => void;
  cartCount?: number;
  compact?: boolean;
};

const getCategoryIcon = (category: string) => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('egg')) return 'egg-outline';
  if (cat.includes('bev') || cat.includes('drink') || cat.includes('soda') || cat.includes('juice')) {
    return 'cup-water';
  }
  return 'shopping-outline';
};

const getCategoryBadgeTone = (category: string) => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('egg')) {
    return {
      bg: '#FEF3C7',
      text: '#92400E',
      border: '#FDE68A'
    };
  }
  if (cat.includes('bev') || cat.includes('drink') || cat.includes('soda') || cat.includes('juice')) {
    return {
      bg: '#E0F2FE',
      text: '#0369A1',
      border: '#BAE6FD'
    };
  }
  return {
    bg: '#F1F5F9',
    text: '#475569',
    border: '#E2E8F0'
  };
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
  const dispatch = useAppDispatch();
  const wishlistItems = useAppSelector((state) => state.wishlist?.items || []);
  const isWishlisted = wishlistItems.some((item) => item._id === product._id);

  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [cartCount]);

  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [product.imageUrl]);

  const rawUrl = product.imageUrl ? String(product.imageUrl).trim() : '';
  const imageUri = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? rawUrl
    : rawUrl.startsWith('/')
    ? `${API_BASE_URL.replace('/api', '')}${rawUrl}`
    : '';

  const showImage = Boolean(imageUri) && !imageError;

  const stockStatus = getStockStatus(product.stock);
  const stockTone = getStockTone(product.stock);
  const isOutOfStock = stockStatus === 'out_of_stock';
  const isLowStock = stockStatus === 'low_stock';
  const moq = Math.max(1, product.minOrderQuantity || 1);
  const catTone = getCategoryBadgeTone(product.category);

  const handleToggleWishlist = () => {
    dispatch(toggleWishlist(product));
    if (isWishlisted) {
      toast.info(`Removed ${product.name} from wishlist`);
    } else {
      toast.success(`Added ${product.name} to wishlist ❤️`);
    }
  };

  const isPending = Boolean(useAppSelector((state) => state.cart?.pendingItems?.[product._id]));

  return (
    <View style={[styles.card, compact && styles.compact]}>
      {/* THUMBNAIL WRAPPER */}
      <Pressable
        onPress={onView}
        disabled={!onView}
        style={({ pressed }) => [styles.imageWrap, pressed && styles.pressed]}
      >
        {showImage ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.image, isOutOfStock && styles.imageMuted]}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.imageFallback}>
            <MaterialCommunityIcons
              name={
                product.category?.toLowerCase().includes('egg')
                  ? 'egg-outline'
                  : product.category?.toLowerCase().includes('bev')
                  ? 'bottle-soda-classic-outline'
                  : 'package-variant-closed'
              }
              size={42}
              color={colors.primary}
            />
          </View>
        )}

        {/* STOCK BADGE */}
        <View
          style={[
            styles.stockBadge,
            { backgroundColor: stockTone.backgroundColor, borderColor: stockTone.borderColor }
          ]}
        >
          <Feather
            name={isOutOfStock ? 'x-circle' : isLowStock ? 'alert-circle' : 'check-circle'}
            size={10}
            color={stockTone.iconColor}
          />
          <Text style={[styles.stockBadgeText, { color: stockTone.textColor }]}>
            {isOutOfStock ? 'Out of stock' : isLowStock ? 'Low stock' : 'In stock'}
          </Text>
        </View>

        {/* WISHLIST BUTTON */}
        <Pressable
          onPress={handleToggleWishlist}
          hitSlop={8}
          style={({ pressed }) => [styles.wishlistBtn, pressed && styles.wishlistPressed]}
          accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={isWishlisted ? '#EF4444' : '#64748B'}
          />
        </Pressable>

        {/* PROMO / BESTSELLER BADGE */}
        {(product.badge || product.isBestSeller) ? (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>
              {product.badge || 'BESTSELLER'}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* CATEGORY & PACK SIZE ROW */}
      <View style={styles.categoryRow}>
        <View style={[styles.catBadge, { backgroundColor: catTone.bg, borderColor: catTone.border }]}>
          <MaterialCommunityIcons name={getCategoryIcon(product.category) as any} size={11} color={catTone.text} />
          <Text style={[styles.categoryText, { color: catTone.text }]}>{product.category || 'General'}</Text>
        </View>
        {product.packSize ? (
          <Text style={styles.packSizeText} numberOfLines={1}>
            {product.packSize}
          </Text>
        ) : null}
      </View>

      {/* TITLE & DESCRIPTION */}
      <Text style={styles.title} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {product.description || 'Wholesale certified supply by AP Enterprises.'}
      </Text>

      {/* PRICING */}
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatINR(product.price)}</Text>
        {product.unit ? <Text style={styles.unit}>/{product.unit}</Text> : null}
        {product.discount ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{product.discount}% OFF</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.moqPill}>
          <Text style={styles.moqText}>Min: {moq} {product.unit || 'unit'}</Text>
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
                disabled={isPending}
                style={[styles.stepperButton, isPending && styles.disabled]}
                hitSlop={6}
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={16} color={colors.primary} />
              </Pressable>
              {isPending ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.stepperLoader} />
              ) : (
                <Text style={styles.stepperCount}>{cartCount} in cart</Text>
              )}
              <Pressable
                onPress={onIncrementCart}
                disabled={isOutOfStock || isPending}
                style={[styles.stepperButton, (isOutOfStock || isPending) && styles.disabled]}
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
                  <Text style={styles.viewButtonText}>Details</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onIncrementCart}
                disabled={isOutOfStock || isPending}
                style={({ pressed }) => [
                  styles.addButton,
                  (isOutOfStock || isPending) && styles.disabled,
                  pressed && !isPending && styles.pressed
                ]}
              >
                {isPending ? (
                  <View style={styles.btnLoadingRow}>
                    <ActivityIndicator size="small" color={colors.white} style={styles.loaderSmall} />
                    <Text style={styles.addButtonText}>Adding...</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="cart-outline" size={15} color={colors.white} />
                    <Text style={styles.addButtonText}>Add to Cart</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {onOpenCart && cartCount > 0 ? (
            <Pressable onPress={onOpenCart} style={styles.goCartButton}>
              <Ionicons name="bag-check-outline" size={14} color={colors.primaryPressed} />
              <Text style={styles.goCartText}>Checkout Cart ({cartCount})</Text>
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
    gap: 6,
    ...shadows.card
  },
  compact: {
    padding: 10
  },
  imageWrap: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: 135,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt
  },
  imageFallback: {
    width: '100%',
    height: 135,
    borderRadius: radius.md,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  imageMuted: {
    opacity: 0.5
  },
  stockBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    zIndex: 2
  },
  stockBadgeText: {
    fontSize: 9.5,
    fontWeight: '800'
  },
  wishlistBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 3
  },
  wishlistPressed: {
    transform: [{ scale: 0.9 }]
  },
  promoBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    backgroundColor: '#0F172A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2
  },
  promoBadgeText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: 6
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  packSizeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1
  },
  title: {
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800'
  },
  description: {
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
    minHeight: 32
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 1,
    gap: 1
  },
  currencySymbol: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '900'
  },
  price: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900'
  },
  unit: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: 2
  },
  discountBadge: {
    marginLeft: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  discountText: {
    color: '#15803D',
    fontSize: 9.5,
    fontWeight: '800'
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
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  moqText: {
    color: colors.primaryPressed,
    fontSize: 10,
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
    gap: 5,
    marginTop: 3
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 6
  },
  viewButton: {
    flex: 1,
    minHeight: 38,
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
    flex: 1.5,
    minHeight: 38,
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
    fontSize: 12,
    fontWeight: '800'
  },
  goCartButton: {
    minHeight: 32,
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
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  loaderSmall: {
    transform: [{ scale: 0.75 }]
  },
  stepperLoader: {
    marginHorizontal: 8,
    transform: [{ scale: 0.75 }]
  }
});
