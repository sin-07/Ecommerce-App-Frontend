import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { AuthPromptAction, AuthPromptModal } from '../components/AuthPromptModal';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailsSkeleton } from '../components/ProductDetailsSkeleton';
import { ErrorView } from '../components/StateViews';
import { api, API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { PricingTier, Product } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { setPendingAction } from '../redux/slices/authSlice';
import { addCartItem, fetchCart, hydrateCart, updateCartItem } from '../redux/slices/cartSlice';
import { fetchProductById } from '../redux/slices/productSlice';
import { toggleWishlist } from '../redux/slices/wishlistSlice';
import { formatINR } from '../utils/currency';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetails'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const resolveImageUrl = (raw?: string) => {
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  return `${API_BASE_URL.replace('/api', '')}${str}`;
};

export const ProductDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { productId, product } = route.params;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAppSelector((state) => state.auth);
  const { selected, items: allProducts, loading, error } = useAppSelector((state) => state.products);
  const { items: cartItems } = useAppSelector((state) => state.cart);
  const { items: wishlistItems } = useAppSelector((state) => state.wishlist);

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalAction, setAuthModalAction] = useState<AuthPromptAction>('cart');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [frequentlyBought, setFrequentlyBought] = useState<Product[]>([]);
  const [addingBundle, setAddingBundle] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;

  const activeProduct = selected?._id === productId ? selected : product;
  const resolved = activeProduct?._id === productId ? activeProduct : selected;

  const isWishlisted = wishlistItems.some((item) => item._id === productId);
  const [quantity, setQuantity] = useState(Math.max(1, (product?.minOrderQuantity || 1) as number));

  const fetchFrequentlyBought = useCallback(async () => {
    try {
      const res = await api.get(`/products/${productId}/frequently-bought-together`);
      if (res.data?.data) {
        setFrequentlyBought(res.data.data);
      }
    } catch {
      // Graceful fallback
    }
  }, [productId]);

  useEffect(() => {
    if (!activeProduct || activeProduct._id !== productId) {
      dispatch(fetchProductById(productId));
    }
    fetchFrequentlyBought();
    dispatch(hydrateCart());
    dispatch(fetchCart());
  }, [dispatch, activeProduct, productId, fetchFrequentlyBought]);

  const onRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchProductById(productId)),
        fetchFrequentlyBought(),
        dispatch(fetchCart())
      ]);
    } catch {
      toast.error('Could not refresh product');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, dispatch, productId, fetchFrequentlyBought]);

  const inCart =
    cartItems.find((item) => {
      const productInCart = item.product as unknown as { _id?: string } | string;
      const id = typeof productInCart === 'string' ? productInCart : productInCart?._id;
      return id === productId;
    })?.quantity || 0;

  useEffect(() => {
    if (!resolved) return;
    const moq = Math.max(1, resolved.minOrderQuantity || 1);
    if (inCart > 0) {
      setQuantity(inCart);
      return;
    }
    setQuantity(moq);
  }, [resolved?._id, resolved?.minOrderQuantity, inCart]);

  const pendingCartItems = useAppSelector((state) => state.cart?.pendingItems || {});
  const isCartPending = Boolean(resolved?._id && pendingCartItems[resolved._id]);

  const galleryImages = useMemo(() => {
    if (!resolved) return [];
    const set = new Set<string>();
    if (resolved.imageUrl) set.add(resolved.imageUrl);
    if (resolved.images && Array.isArray(resolved.images)) {
      resolved.images.forEach((img) => {
        if (img) set.add(img);
      });
    }
    return Array.from(set);
  }, [resolved]);

  const currentImageUrl = resolveImageUrl(galleryImages[selectedImageIndex] || resolved?.imageUrl);

  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
  }, [currentImageUrl]);

  const relatedProducts = useMemo(() => {
    if (!resolved) return [];
    return allProducts
      .filter((p) => p._id !== resolved._id && p.category === resolved.category)
      .slice(0, 4);
  }, [allProducts, resolved]);

  if (loading && !resolved) return <ProductDetailsSkeleton />;
  if (error && !resolved) return <ErrorView message={error} onRetry={() => dispatch(fetchProductById(productId))} />;
  if (!resolved) return <ErrorView message="Product item unavailable" />;

  const isUnavailable = resolved.availabilityStatus === 'unavailable' || resolved.isActive === false;
  const isOutOfStock = !isUnavailable && (resolved.availabilityStatus === 'out_of_stock' || resolved.stock <= 0);
  const isLowStock = !isUnavailable && !isOutOfStock && resolved.stock > 0 && resolved.stock <= 10;
  const isPurchasable = !isUnavailable && !isOutOfStock;
  const moq = Math.max(1, resolved.minOrderQuantity || 1);
  const maxQty = Math.max(moq, resolved.stock || moq);
  const unitName = resolved.unit || 'unit';

  // Active Bulk Pricing Tier Evaluation
  const pricingTiers: PricingTier[] = resolved.pricingTiers || [];
  const activeTier = pricingTiers.find((tier) => {
    if (tier.maxQty != null) {
      return quantity >= tier.minQty && quantity <= tier.maxQty;
    }
    return quantity >= tier.minQty;
  });

  const effectiveUnitPrice = activeTier ? activeTier.price : resolved.price;
  const subtotal = effectiveUnitPrice * quantity;

  const decrementQty = () => {
    setQuantity((prev) => Math.max(moq, prev - 1));
  };

  const incrementQty = () => {
    setQuantity((prev) => Math.min(maxQty, prev + 1));
  };

  const triggerAuthPrompt = (action: AuthPromptAction) => {
    setAuthModalAction(action);
    setAuthModalVisible(true);
  };

  const handleAuthModalSignIn = () => {
    if (resolved) {
      dispatch(
        setPendingAction({
          type: authModalAction === 'wishlist' ? 'WISHLIST' : authModalAction === 'buy_now' ? 'BUY_NOW' : 'ADD_TO_CART',
          productId: resolved._id,
          product: resolved,
          quantity
        })
      );
    }
    setAuthModalVisible(false);
    navigation.navigate('Login');
  };

  const handleAuthModalSignUp = () => {
    if (resolved) {
      dispatch(
        setPendingAction({
          type: authModalAction === 'wishlist' ? 'WISHLIST' : authModalAction === 'buy_now' ? 'BUY_NOW' : 'ADD_TO_CART',
          productId: resolved._id,
          product: resolved,
          quantity
        })
      );
    }
    setAuthModalVisible(false);
    navigation.navigate('Register');
  };

  const handleWishlist = () => {
    if (!user) {
      haptics.lightImpact();
      triggerAuthPrompt('wishlist');
      return;
    }
    haptics.lightImpact();
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
    ]).start();

    dispatch(toggleWishlist(resolved));
    if (isWishlisted) {
      toast.info(`Removed ${resolved.name} from wishlist`);
    } else {
      toast.success(`Saved to wishlist ❤️`);
    }
  };

  const addOrUpdateCart = async () => {
    if (isCartPending) return;
    if (!user) {
      haptics.lightImpact();
      triggerAuthPrompt('cart');
      return;
    }

    if (!isPurchasable) {
      haptics.errorNotification();
      toast.error(isUnavailable ? 'This product is currently unavailable.' : 'This product is currently out of stock.');
      return;
    }

    if (quantity < moq) {
      haptics.errorNotification();
      toast.error(`Minimum wholesale order is ${moq} ${unitName}(s).`);
      return;
    }

    if (quantity > resolved.stock) {
      haptics.errorNotification();
      toast.error(`Only ${resolved.stock} ${unitName}(s) available in warehouse.`);
      return;
    }

    haptics.mediumImpact();
    try {
      if (inCart <= 0) {
        await dispatch(addCartItem({ productId: resolved._id, quantity })).unwrap();
        toast.success(`Added ${quantity} ${unitName}(s) to cart.`);
      } else {
        await dispatch(updateCartItem({ productId: resolved._id, quantity })).unwrap();
        toast.success('Cart updated.');
      }
    } catch (cartError: any) {
      haptics.errorNotification();
      toast.error(cartError || 'Failed to update cart');
    }
  };

  const handleAddBundleToCart = async (bundleProduct: Product) => {
    if (!user) {
      haptics.lightImpact();
      triggerAuthPrompt('cart');
      return;
    }
    if (addingBundle) return;
    setAddingBundle(true);
    haptics.mediumImpact();
    try {
      const currentMoq = Math.max(1, resolved.minOrderQuantity || 1);
      const bundleMoq = Math.max(1, bundleProduct.minOrderQuantity || 1);

      await Promise.all([
        dispatch(addCartItem({ productId: resolved._id, quantity: Math.max(currentMoq, inCart || currentMoq) })).unwrap(),
        dispatch(addCartItem({ productId: bundleProduct._id, quantity: bundleMoq })).unwrap()
      ]);
      haptics.successNotification();
      toast.success(`Added bundle: ${resolved.name} + ${bundleProduct.name} to cart!`);
    } catch (err: any) {
      haptics.errorNotification();
      toast.error(err || 'Failed to add bundle to cart');
    } finally {
      setAddingBundle(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      haptics.lightImpact();
      triggerAuthPrompt('buy_now');
      return;
    }

    if (!isPurchasable) {
      haptics.errorNotification();
      toast.error(isUnavailable ? 'This product is currently unavailable.' : 'This product is currently out of stock.');
      return;
    }

    if (quantity < moq) {
      haptics.errorNotification();
      toast.error(`Minimum wholesale order is ${moq} ${unitName}(s).`);
      return;
    }

    haptics.mediumImpact();
    try {
      await dispatch(addCartItem({ productId: resolved._id, quantity })).unwrap();
      navigation.navigate('Cart');
    } catch (cartError: any) {
      haptics.errorNotification();
      toast.error(cartError || 'Failed to proceed to checkout');
    }
  };

  const showImage = Boolean(currentImageUrl) && !imageError;

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* 1. HERO IMAGE & GALLERY CONTAINER */}
        <View style={styles.heroCard}>
          {showImage ? (
            <View style={styles.imageWrap}>
              {imageLoading ? (
                <View style={styles.imageLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : null}
              <Image
                source={{ uri: currentImageUrl }}
                style={styles.image}
                resizeMode="cover"
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
            </View>
          ) : (
            <View style={styles.noImageWrap}>
              <MaterialCommunityIcons
                name={
                  resolved.category?.toLowerCase().includes('egg')
                    ? 'egg-outline'
                    : resolved.category?.toLowerCase().includes('bev')
                    ? 'bottle-soda-classic-outline'
                    : 'package-variant-closed'
                }
                size={64}
                color={colors.primary}
              />
              <Text style={styles.noImage}>AP Enterprises Wholesale Supply</Text>
            </View>
          )}

          {/* WISHLIST FLOATING BUTTON */}
          <Animated.View style={[styles.wishlistBtnWrap, { transform: [{ scale: heartScale }] }]}>
            <TouchableOpacity style={styles.wishlistBtn} onPress={handleWishlist} hitSlop={8}>
              <Ionicons
                name={isWishlisted ? 'heart' : 'heart-outline'}
                size={22}
                color={isWishlisted ? '#EF4444' : '#64748B'}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* STOCK STATUS PILL */}
          <View
            style={[
              styles.stockFloatingBadge,
              isUnavailable
                ? { backgroundColor: '#F1F5F9' }
                : { backgroundColor: isOutOfStock ? '#FEE2E2' : isLowStock ? '#FEF3C7' : '#DCFCE7' }
            ]}
          >
            <Feather
              name={isUnavailable ? 'slash' : isOutOfStock ? 'x-circle' : isLowStock ? 'alert-circle' : 'check-circle'}
              size={11}
              color={isUnavailable ? '#64748B' : isOutOfStock ? '#DC2626' : isLowStock ? '#D97706' : '#16A34A'}
            />
            <Text
              style={[
                styles.stockFloatingText,
                { color: isUnavailable ? '#64748B' : isOutOfStock ? '#DC2626' : isLowStock ? '#D97706' : '#16A34A' }
              ]}
            >
              {isUnavailable
                ? 'Currently Unavailable'
                : isOutOfStock
                ? 'Out of Stock'
                : isLowStock
                ? `Low Stock (${resolved.stock})`
                : 'In Stock & Ready'}
            </Text>
          </View>
        </View>

        {/* THUMBNAIL GALLERY STRIP */}
        {galleryImages.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryStrip}>
            {galleryImages.map((imgUrl, idx) => {
              const uri = resolveImageUrl(imgUrl);
              const isSelected = selectedImageIndex === idx;
              return (
                <TouchableOpacity
                  key={`thumb-${idx}`}
                  style={[styles.thumbnailWrap, isSelected && styles.thumbnailSelected]}
                  onPress={() => setSelectedImageIndex(idx)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri }} style={styles.thumbnailImg} resizeMode="cover" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* 2. PRODUCT HEADER & PRICING */}
        <View style={styles.sectionCard}>
          <View style={styles.categoryRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{resolved.category || 'General'}</Text>
            </View>
            {resolved.packSize ? (
              <View style={styles.packPill}>
                <Text style={styles.packPillText}>{resolved.packSize}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.name}>{resolved.name}</Text>

          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>{formatINR(effectiveUnitPrice)}</Text>
              <Text style={styles.unitText}>/{unitName}</Text>
            </View>
            {resolved.discount ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{resolved.discount}% Wholesale Discount</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.description}>{resolved.description}</Text>
        </View>

        {/* 3. WHOLESALE BULK PRICING TIERS TABLE (If supported by backend) */}
        {pricingTiers.length > 0 ? (
          <View style={styles.sectionCard}>
            <View style={styles.tierHeaderRow}>
              <MaterialCommunityIcons name="tag-multiple-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Wholesale Volume Pricing</Text>
            </View>
            <Text style={styles.tierSubtitle}>Tier discounts applied automatically based on order quantity</Text>

            <View style={styles.tierTable}>
              <View style={styles.tierTableHeader}>
                <Text style={[styles.tierHeaderCell, { flex: 1.2 }]}>Order Quantity</Text>
                <Text style={[styles.tierHeaderCell, { flex: 1 }]}>Unit Price</Text>
                <Text style={[styles.tierHeaderCell, { flex: 1, textAlign: 'right' }]}>Savings</Text>
              </View>

              {pricingTiers.map((tier, i) => {
                const isCurrent = activeTier === tier;
                const qtyRange = tier.maxQty ? `${tier.minQty} – ${tier.maxQty} ${unitName}s` : `${tier.minQty}+ ${unitName}s`;
                const savingsPct = tier.discountPercentage || Math.round(((resolved.price - tier.price) / resolved.price) * 100);

                return (
                  <View key={`tier-${i}`} style={[styles.tierTableRow, isCurrent && styles.tierTableRowActive]}>
                    <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {isCurrent ? <Ionicons name="checkmark-circle" size={14} color={colors.primary} /> : null}
                      <Text style={[styles.tierCellText, isCurrent && styles.tierCellTextActive]}>{qtyRange}</Text>
                    </View>
                    <Text style={[styles.tierCellText, { flex: 1 }, isCurrent && styles.tierCellTextActive]}>
                      {formatINR(tier.price)}
                    </Text>
                    <Text style={[styles.tierSavingsText, { flex: 1, textAlign: 'right' }]}>
                      {savingsPct > 0 ? `${savingsPct}% OFF` : 'Standard'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* 4. SPECIFICATIONS */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Wholesale Specifications</Text>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Product Category</Text>
            <Text style={styles.value}>{resolved.category}</Text>
          </View>
          {resolved.packSize ? (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Pack Configuration</Text>
              <Text style={styles.value}>{resolved.packSize}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.label}>Unit Price</Text>
            <Text style={styles.value}>{formatINR(effectiveUnitPrice)} per {unitName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Warehouse Stock</Text>
            <Text style={[styles.value, isOutOfStock && styles.outOfStockText]}>
              {isOutOfStock ? '0 (Out of stock)' : `${resolved.stock} ${unitName}(s) available`}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Min Order Quantity (MOQ)</Text>
            <Text style={styles.value}>{resolved.minOrderQuantity || 1} {unitName}(s)</Text>
          </View>

          {resolved.specifications && resolved.specifications.length > 0
            ? resolved.specifications.map((spec, idx) => (
                <View key={`spec-${idx}`} style={styles.detailRow}>
                  <Text style={styles.label}>{spec.key}</Text>
                  <Text style={styles.value}>{spec.value}</Text>
                </View>
              ))
            : null}
        </View>

        {/* 5. INLINE QUANTITY SELECTOR & SUMMARY */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Select Order Quantity</Text>
          <Text style={styles.inCart}>
            Choose quantity in {unitName}s for wholesale dispatch:
          </Text>

          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyButton} activeOpacity={0.8} onPress={decrementQty}>
              <Ionicons name="remove" size={20} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.counterPill}>
              <Text style={styles.counterLabel}>{unitName.toUpperCase()}S</Text>
              <Text style={styles.counterValue}>{quantity}</Text>
            </View>

            <TouchableOpacity
              style={styles.qtyButton}
              activeOpacity={0.8}
              onPress={incrementQty}
              disabled={quantity >= maxQty}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.pricingSummary}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Effective Unit Price</Text>
              <Text style={styles.value}>{formatINR(effectiveUnitPrice)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Calculated Subtotal ({quantity} {unitName}s)</Text>
              <Text style={styles.subtotalText}>{formatINR(subtotal)}</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <AppButton
              title={
                isUnavailable
                  ? 'Currently Unavailable'
                  : isOutOfStock
                  ? 'Out of Stock'
                  : inCart > 0
                  ? `Update Cart (${quantity} ${unitName}s)`
                  : `Add ${quantity} ${unitName}${quantity === 1 ? '' : 's'} to Cart`
              }
              icon={isUnavailable ? 'close-circle' : isOutOfStock ? 'alert-circle' : inCart > 0 ? 'cart-check' : 'cart-plus'}
              loading={isCartPending}
              onPress={addOrUpdateCart}
              disabled={!isPurchasable}
            />
            <AppButton
              title={isUnavailable ? 'Unavailable' : isOutOfStock ? 'Out of Stock' : 'Buy Now / Checkout'}
              icon="flash"
              variant="secondary"
              onPress={handleBuyNow}
              disabled={!isPurchasable || isCartPending}
            />
          </View>
        </View>

        {/* 5.5 FREQUENTLY BOUGHT TOGETHER (REAL HISTORICAL CO-PURCHASE DATA) */}
        {frequentlyBought && frequentlyBought.length > 0 ? (
          <View style={styles.bundleSection}>
            <View style={styles.bundleHeader}>
              <MaterialCommunityIcons name="tag-multiple-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bundleTitle}>Frequently Bought Together</Text>
                <Text style={styles.bundleSubtitle}>Frequently ordered together by trade buyers</Text>
              </View>
            </View>

            {frequentlyBought.slice(0, 1).map((coItem) => {
              const coMoq = Math.max(1, coItem.minOrderQuantity || 1);
              const bundleCombinedPrice = resolved.price * moq + coItem.price * coMoq;
              const coImg = resolveImageUrl(coItem.imageUrl);

              return (
                <View key={`bundle-${coItem._id}`} style={styles.bundleCard}>
                  <View style={styles.bundleItemsRow}>
                    {/* Item 1 (Current) */}
                    <View style={styles.bundleThumbBox}>
                      {showImage ? (
                        <Image source={{ uri: currentImageUrl }} style={styles.bundleThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.bundleThumbFallback}>
                          <MaterialCommunityIcons name="cube-outline" size={20} color={colors.primary} />
                        </View>
                      )}
                      <Text style={styles.bundleItemName} numberOfLines={1}>
                        {resolved.name}
                      </Text>
                      <Text style={styles.bundleItemPrice}>{formatINR(resolved.price)}</Text>
                    </View>

                    {/* Plus Separator */}
                    <View style={styles.bundlePlusCircle}>
                      <Ionicons name="add" size={18} color={colors.primary} />
                    </View>

                    {/* Item 2 (Frequently Bought) */}
                    <TouchableOpacity
                      style={styles.bundleThumbBox}
                      onPress={() => navigation.push('ProductDetails', { productId: coItem._id, product: coItem })}
                      activeOpacity={0.85}
                    >
                      {coImg ? (
                        <Image source={{ uri: coImg }} style={styles.bundleThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.bundleThumbFallback}>
                          <MaterialCommunityIcons name="cube-outline" size={20} color={colors.primary} />
                        </View>
                      )}
                      <Text style={styles.bundleItemName} numberOfLines={1}>
                        {coItem.name}
                      </Text>
                      <Text style={styles.bundleItemPrice}>{formatINR(coItem.price)}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.bundleFooter}>
                    <View>
                      <Text style={styles.bundleTotalLabel}>Combined Price (Min MOQ):</Text>
                      <Text style={styles.bundleTotalPrice}>{formatINR(bundleCombinedPrice)}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.bundleAddBtn, addingBundle && styles.bundleAddBtnDisabled]}
                      onPress={() => handleAddBundleToCart(coItem)}
                      disabled={addingBundle}
                      activeOpacity={0.88}
                    >
                      {addingBundle ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="cart-plus" size={16} color={colors.white} />
                          <Text style={styles.bundleAddBtnText}>Add Both to Cart</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* 6. RELATED PRODUCTS */}
        {relatedProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Related in {resolved.category}</Text>
            <View style={styles.relatedGrid}>
              {relatedProducts.map((item) => (
                <View key={item._id} style={styles.relatedCell}>
                  <ProductCard
                    product={item}
                    compact
                    onView={() => navigation.push('ProductDetails', { productId: item._id, product: item })}
                    onIncrementCart={() => {
                      if (!user) {
                        triggerAuthPrompt('cart');
                      } else {
                        dispatch(addCartItem({ productId: item._id, quantity: item.minOrderQuantity || 1 }));
                        toast.success(`Added ${item.name} to cart.`);
                      }
                    }}
                    onRequireAuth={(action) => triggerAuthPrompt(action === 'wishlist' ? 'wishlist' : 'cart')}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 7. STICKY BOTTOM PURCHASE BAR */}
      <View style={[styles.stickyBottomBar, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
        <View style={styles.stickyStepperWrap}>
          <TouchableOpacity
            style={styles.stickyStepperBtn}
            onPress={decrementQty}
            disabled={quantity <= moq}
            hitSlop={6}
          >
            <Ionicons name="remove" size={18} color={quantity <= moq ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
          <View style={styles.stickyQtyCenter}>
            <Text style={styles.stickyQtyValue}>{quantity}</Text>
            <Text style={styles.stickyQtyUnit}>{unitName}s</Text>
          </View>
          <TouchableOpacity
            style={styles.stickyStepperBtn}
            onPress={incrementQty}
            disabled={quantity >= maxQty}
            hitSlop={6}
          >
            <Ionicons name="add" size={18} color={quantity >= maxQty ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.stickyAddBtn, isOutOfStock && styles.stickyBtnDisabled]}
          onPress={addOrUpdateCart}
          disabled={isOutOfStock || isCartPending}
          activeOpacity={0.88}
        >
          {isCartPending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <View style={styles.stickyBtnInner}>
              <Ionicons name="cart" size={18} color={colors.white} />
              <View>
                <Text style={styles.stickyBtnTitle}>{inCart > 0 ? 'Update Cart' : 'Add to Cart'}</Text>
                <Text style={styles.stickyBtnPrice}>{formatINR(subtotal)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* AUTH PROMPT MODAL FOR GUESTS */}
      <AuthPromptModal
        visible={authModalVisible}
        action={authModalAction}
        product={resolved}
        quantity={quantity}
        onClose={() => setAuthModalVisible(false)}
        onSignIn={handleAuthModalSignIn}
        onSignUp={handleAuthModalSignUp}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scrollContent: {
    padding: 16,
    gap: 14
  },
  heroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.card
  },
  imageWrap: {
    width: '100%',
    height: 250,
    position: 'relative'
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cardAlt
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  noImageWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 44
  },
  noImage: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  },
  wishlistBtnWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 3
  },
  wishlistBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card
  },
  stockFloatingBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    zIndex: 2
  },
  stockFloatingText: {
    fontSize: 10.5,
    fontWeight: '800'
  },
  galleryStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2
  },
  thumbnailWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt
  },
  thumbnailSelected: {
    borderColor: colors.primary
  },
  thumbnailImg: {
    width: '100%',
    height: '100%'
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 16,
    gap: 12,
    ...shadows.card
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  categoryPill: {
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase'
  },
  packPill: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  packPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.navy,
    lineHeight: 26
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap'
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  priceText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.navy
  },
  unitText: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 2
  },
  discountBadge: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  discountText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.success
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19
  },
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  tierSubtitle: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: -6
  },
  tierTable: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  tierTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  tierHeaderCell: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  tierTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.card
  },
  tierTableRowActive: {
    backgroundColor: colors.infoSurface
  },
  tierCellText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text
  },
  tierCellTextActive: {
    fontWeight: '800',
    color: colors.primary
  },
  tierSavingsText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.success
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.navy
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  label: {
    fontSize: 12.5,
    color: colors.textSecondary
  },
  value: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.text
  },
  outOfStockText: {
    color: colors.danger
  },
  inCart: {
    fontSize: 12,
    color: colors.textSecondary
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  counterPill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 28,
    paddingVertical: 6,
    borderRadius: radius.md,
    minWidth: 120
  },
  counterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5
  },
  counterValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.navy
  },
  pricingSummary: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 12,
    gap: 4
  },
  subtotalText: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.navy
  },
  actionButtons: {
    gap: 10,
    marginTop: 4
  },
  relatedSection: {
    gap: 12,
    marginTop: 4
  },
  relatedTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.navy
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  relatedCell: {
    width: '48.5%',
    marginBottom: 12
  },
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.card
  },
  stickyStepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: 4
  },
  stickyStepperBtn: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stickyQtyCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
    paddingHorizontal: 2
  },
  stickyQtyValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.navy
  },
  stickyQtyUnit: {
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.textMuted
  },
  stickyAddBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  stickyBtnDisabled: {
    opacity: 0.5
  },
  stickyBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  stickyBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white
  },
  stickyBtnPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)'
  },
  bundleSection: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadows.card
  },
  bundleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  bundleTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.navy
  },
  bundleSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1
  },
  bundleCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12
  },
  bundleItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  bundleThumbBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4
  },
  bundleThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.card
  },
  bundleThumbFallback: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bundleItemName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center'
  },
  bundleItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary
  },
  bundlePlusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8
  },
  bundleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  bundleTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary
  },
  bundleTotalPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.navy
  },
  bundleAddBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  bundleAddBtnDisabled: {
    opacity: 0.6
  },
  bundleAddBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800'
  }
});
