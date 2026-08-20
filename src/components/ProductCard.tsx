import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Product } from '../constants/types';
import { API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { getStockLabel, getStockTone, getStockStatus } from '../utils/stock';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { toggleWishlist } from '../redux/slices/wishlistSlice';
import { formatINR } from '../utils/currency';
import { toast } from '../utils/toast';

export const CARD_IMAGE_HEIGHT = 125;
export const CARD_TOTAL_HEIGHT = 352;

type Props = {
  product: Product;
  onView?: () => void;
  onIncrementCart?: () => void;
  onDecrementCart?: () => void;
  onOpenCart?: () => void;
  onRequireAuth?: (action: 'cart' | 'wishlist', product: Product, quantity?: number) => void;
  cartCount?: number;
  compact?: boolean;
};

const getCategoryIcon = (category: string) => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('egg')) return 'egg-outline';
  if (cat.includes('bev') || cat.includes('drink') || cat.includes('soda') || cat.includes('juice')) {
    return 'cup-water';
  }
  return 'package-variant-closed';
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
  onRequireAuth,
  cartCount = 0,
  compact
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const wishlistItems = useAppSelector((state) => state.wishlist?.items || []);
  const isWishlisted = wishlistItems.some((item) => item._id === product._id);
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
    if (!user) {
      if (onRequireAuth) onRequireAuth('wishlist', product);
      return;
    }
    dispatch(toggleWishlist(product));
    if (isWishlisted) {
      toast.info(`Removed ${product.name} from wishlist`);
    } else {
      toast.success(`Added ${product.name} to wishlist ❤️`);
    }
  };

  const handleIncrementPress = () => {
    if (!user) {
      if (onRequireAuth) onRequireAuth('cart', product, moq);
      return;
    }
    if (onIncrementCart) onIncrementCart();
  };

  const handleDecrementPress = () => {
    if (!user) {
      if (onRequireAuth) onRequireAuth('cart', product, moq);
      return;
    }
    if (onDecrementCart) onDecrementCart();
  };

  const isPending = Boolean(useAppSelector((state) => state.cart?.pendingItems?.[product._id]));

  return (
    <View style={[styles.card, compact && styles.compact]}>
      {/* 1. FIXED IMAGE CONTAINER (125px) */}
      <Pressable
        onPress={onView}
        disabled={!onView}
        style={({ pressed }) => [styles.imageWrap, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`View ${product.name}`}
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
                  ? 'cup-water'
                  : 'package-variant-closed'
              }
              size={38}
              color={colors.primary}
            />
          </View>
        )}

        {/* STOCK STATUS BADGE */}
        <View
          style={[
            styles.stockBadge,
            { backgroundColor: stockTone.backgroundColor, borderColor: stockTone.borderColor }
          ]}
        >
          <Feather
            name={isOutOfStock ? 'x-circle' : isLowStock ? 'alert-circle' : 'check-circle'}
            size={9.5}
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
          accessibilityRole="button"
          accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={17}
            color={isWishlisted ? '#EF4444' : '#64748B'}
          />
        </Pressable>

        {/* BESTSELLER / PROMO BADGE */}
        {product.badge || product.isBestSeller ? (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>{product.badge || 'BESTSELLER'}</Text>
          </View>
        ) : null}
      </Pressable>

      {/* 2. BODY CONTENT WITH STRICT SLOT HEIGHTS */}
      <View style={styles.bodyContent}>
        {/* SLOT A: CATEGORY & PACK SIZE (20px) */}
        <View style={styles.categoryRow}>
          <View style={[styles.catBadge, { backgroundColor: catTone.bg, borderColor: catTone.border }]}>
            <MaterialCommunityIcons name={getCategoryIcon(product.category) as any} size={10.5} color={catTone.text} />
            <Text style={[styles.categoryText, { color: catTone.text }]} numberOfLines={1}>
              {product.category || 'General'}
            </Text>
          </View>
          {product.packSize ? (
            <Text style={styles.packSizeText} numberOfLines={1}>
              {product.packSize}
            </Text>
          ) : (
            <View style={styles.emptySlot} />
          )}
        </View>

        {/* SLOT B: TITLE AREA (STRICT 38px, MAX 2 LINES) */}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={2}>
            {product.name}
          </Text>
        </View>

        {/* SLOT C: DESCRIPTION AREA (STRICT 30px, MAX 2 LINES) */}
        <View style={styles.descriptionWrap}>
          <Text style={styles.description} numberOfLines={2}>
            {product.description || 'Wholesale certified supply by AP Enterprises.'}
          </Text>
        </View>

        {/* SLOT D: PRICE ROW (STRICT 24px) */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatINR(product.price)}</Text>
          {product.unit ? <Text style={styles.unit}>/{product.unit}</Text> : null}
          {product.discount ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{product.discount}% OFF</Text>
            </View>
          ) : null}
        </View>

        {/* SLOT E: MOQ & STOCK ROW (STRICT 22px) */}
        <View style={styles.metaRow}>
          <View style={styles.moqPill}>
            <Text style={styles.moqText}>Min: {moq} {product.unit || 'unit'}</Text>
          </View>
          <Text style={[styles.stock, isOutOfStock && styles.stockOut]} numberOfLines={1}>
            {getStockLabel(product.stock)}
          </Text>
        </View>
      </View>

      {/* 3. FIXED BOTTOM ACTION BUTTONS (38px) */}
      <View style={styles.actionsWrap}>
        {cartCount > 0 ? (
          <View style={styles.stepperWrap}>
            <Pressable
              onPress={handleDecrementPress}
              disabled={isPending}
              style={[styles.stepperButton, isPending && styles.disabled]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
            >
              <Ionicons name="remove" size={15} color={colors.primary} />
            </Pressable>

            {isPending ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.stepperLoader} />
            ) : (
              <Text style={styles.stepperCount} numberOfLines={1}>
                {cartCount} in cart
              </Text>
            )}

            <Pressable
              onPress={handleIncrementPress}
              disabled={isOutOfStock || isPending}
              style={[styles.stepperButton, (isOutOfStock || isPending) && styles.disabled]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <Ionicons name="add" size={15} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.topActionsRow}>
            {onView ? (
              <Pressable
                onPress={onView}
                style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Details of ${product.name}`}
              >
                <Text style={styles.viewButtonText}>Details</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleIncrementPress}
              disabled={isOutOfStock || isPending}
              style={({ pressed }) => [
                styles.addButton,
                (isOutOfStock || isPending) && styles.disabled,
                pressed && !isPending && styles.pressed
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Add ${product.name} to cart`}
            >
              {isPending ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color={colors.white} style={styles.loaderSmall} />
                  <Text style={styles.addButtonText}>Adding...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="cart-outline" size={14} color={colors.white} />
                  <Text style={styles.addButtonText}>Add to Cart</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
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
    padding: 10,
    height: CARD_TOTAL_HEIGHT,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadows.card
  },
  compact: {
    padding: 10
  },
  imageWrap: {
    height: CARD_IMAGE_HEIGHT,
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.cardAlt
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt
  },
  imageFallback: {
    width: '100%',
    height: '100%',
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
    top: 6,
    left: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    zIndex: 2
  },
  stockBadgeText: {
    fontSize: 9,
    fontWeight: '800'
  },
  wishlistBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
    zIndex: 3
  },
  wishlistPressed: {
    transform: [{ scale: 0.9 }]
  },
  promoBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2
  },
  promoBadgeText: {
    color: '#F8FAFC',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  bodyContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 6
  },
  categoryRow: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '65%'
  },
  categoryText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2
  },
  packSizeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right'
  },
  emptySlot: {
    width: 1,
    height: 1
  },
  titleWrap: {
    height: 38,
    justifyContent: 'center'
  },
  title: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800'
  },
  descriptionWrap: {
    height: 30,
    justifyContent: 'center'
  },
  description: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15
  },
  priceRow: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  price: {
    color: colors.navy,
    fontSize: 16.5,
    fontWeight: '900'
  },
  unit: {
    color: colors.textMuted,
    fontSize: 10.5,
    marginLeft: 1
  },
  discountBadge: {
    marginLeft: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderRadius: 4
  },
  discountText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800'
  },
  metaRow: {
    height: 22,
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
    paddingHorizontal: 6,
    paddingVertical: 1.5
  },
  moqText: {
    color: colors.primaryPressed,
    fontSize: 9.5,
    fontWeight: '800'
  },
  stock: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right'
  },
  stockOut: {
    color: colors.danger
  },
  actionsWrap: {
    height: 38,
    marginTop: 6,
    justifyContent: 'center'
  },
  topActionsRow: {
    flexDirection: 'row',
    height: '100%',
    gap: 6
  },
  viewButton: {
    flex: 1,
    height: '100%',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewButtonText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '800'
  },
  addButton: {
    flex: 1.4,
    height: '100%',
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4
  },
  addButtonText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '800'
  },
  stepperWrap: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 4
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  stepperCount: {
    color: colors.primaryPressed,
    fontSize: 11.5,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center'
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
    transform: [{ scale: 0.7 }]
  },
  stepperLoader: {
    transform: [{ scale: 0.7 }]
  }
});
