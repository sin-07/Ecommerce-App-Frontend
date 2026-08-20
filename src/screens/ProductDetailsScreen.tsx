import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { AppButton } from '../components/AppButton';
import { AuthPromptAction, AuthPromptModal } from '../components/AuthPromptModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { API_BASE_URL } from '../constants/api';
import { ErrorView, LoadingView } from '../components/StateViews';
import { colors, radius, shadows } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { setPendingAction } from '../redux/slices/authSlice';
import { addCartItem, fetchCart, hydrateCart, updateCartItem } from '../redux/slices/cartSlice';
import { fetchProductById } from '../redux/slices/productSlice';
import { toggleWishlist } from '../redux/slices/wishlistSlice';
import { formatINR } from '../utils/currency';
import { toast } from '../utils/toast';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailsSkeleton } from '../components/ProductDetailsSkeleton';
import { Product } from '../constants/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetails'>;

export const ProductDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { productId, product } = route.params;
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { selected, items: allProducts, loading, error } = useAppSelector((state) => state.products);
  const { items: cartItems } = useAppSelector((state) => state.cart);
  const { items: wishlistItems } = useAppSelector((state) => state.wishlist);

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalAction, setAuthModalAction] = useState<AuthPromptAction>('cart');

  const activeProduct = selected?._id === productId ? selected : product;
  const resolved = activeProduct?._id === productId ? activeProduct : selected;

  const isWishlisted = wishlistItems.some((item) => item._id === productId);
  const [quantity, setQuantity] = useState(Math.max(1, (product?.minOrderQuantity || 1) as number));

  useEffect(() => {
    if (!activeProduct || activeProduct._id !== productId) {
      dispatch(fetchProductById(productId));
    }
    dispatch(hydrateCart());
    dispatch(fetchCart());
  }, [dispatch, activeProduct, productId]);

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

  const relatedProducts = useMemo(() => {
    if (!resolved) return [];
    return allProducts
      .filter((p) => p._id !== resolved._id && p.category === resolved.category)
      .slice(0, 4);
  }, [allProducts, resolved]);

  if (loading && !resolved) return <ProductDetailsSkeleton />;
  if (error && !resolved) return <ErrorView message={error} onRetry={() => dispatch(fetchProductById(productId))} />;
  if (!resolved) return <ErrorView message="Product item unavailable" />;


  const isOutOfStock = resolved.stock <= 0;
  const isLowStock = resolved.stock > 0 && resolved.stock <= 10;
  const moq = Math.max(1, resolved.minOrderQuantity || 1);
  const maxQty = Math.max(moq, resolved.stock || moq);
  const unitName = resolved.unit || 'unit';
  const subtotal = resolved.price * quantity;

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
      triggerAuthPrompt('wishlist');
      return;
    }
    dispatch(toggleWishlist(resolved));
    if (isWishlisted) {
      toast.info(`Removed ${resolved.name} from wishlist`);
    } else {
      toast.success(`Saved to wishlist`);
    }
  };

  const addOrUpdateCart = async () => {
    if (!user) {
      triggerAuthPrompt('cart');
      return;
    }

    if (isOutOfStock) {
      toast.error('This product is currently out of stock.');
      return;
    }

    if (quantity < moq) {
      toast.error(`Minimum wholesale order is ${moq} ${unitName}(s).`);
      return;
    }

    if (quantity > resolved.stock) {
      toast.error(`Only ${resolved.stock} ${unitName}(s) available in warehouse.`);
      return;
    }

    try {
      if (inCart <= 0) {
        await dispatch(addCartItem({ productId: resolved._id, quantity })).unwrap();
        toast.success(`Added ${quantity} ${unitName}(s) to cart.`);
      } else {
        await dispatch(updateCartItem({ productId: resolved._id, quantity })).unwrap();
        toast.success('Cart updated.');
      }
    } catch (cartError: any) {
      toast.error(cartError || 'Failed to update cart');
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      triggerAuthPrompt('buy_now');
      return;
    }
    await addOrUpdateCart();
    navigation.navigate('Cart');
  };

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [resolved?.imageUrl]);

  const rawUrl = resolved.imageUrl ? String(resolved.imageUrl).trim() : '';
  const imageUri = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? rawUrl
    : rawUrl.startsWith('/')
    ? `${API_BASE_URL.replace('/api', '')}${rawUrl}`
    : '';

  const showImage = Boolean(imageUri) && !imageError;

  return (
    <ScreenContainer>
      {/* HERO IMAGE CONTAINER */}
      <View style={styles.heroCard}>
        {showImage ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
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
            <Text style={styles.noImage}>AP Enterprises Wholesale Catalog</Text>
          </View>
        )}

        {/* WISHLIST FLOATING BUTTON */}
        <TouchableOpacity style={styles.wishlistBtn} onPress={handleWishlist} hitSlop={8}>
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={22}
            color={isWishlisted ? '#EF4444' : '#64748B'}
          />
        </TouchableOpacity>

        {/* STOCK STATUS PILL */}
        <View
          style={[
            styles.stockFloatingBadge,
            { backgroundColor: isOutOfStock ? '#FEE2E2' : isLowStock ? '#FEF3C7' : '#DCFCE7' }
          ]}
        >
          <Feather
            name={isOutOfStock ? 'x-circle' : isLowStock ? 'alert-circle' : 'check-circle'}
            size={11}
            color={isOutOfStock ? '#DC2626' : isLowStock ? '#D97706' : '#16A34A'}
          />
          <Text
            style={[
              styles.stockFloatingText,
              { color: isOutOfStock ? '#DC2626' : isLowStock ? '#D97706' : '#16A34A' }
            ]}
          >
            {isOutOfStock ? 'Out of Stock' : isLowStock ? `Low Stock (${resolved.stock})` : 'In Stock & Ready'}
          </Text>
        </View>
      </View>

      {/* PRODUCT HEADER & PRICING */}
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
            <Text style={styles.priceText}>{formatINR(resolved.price)}</Text>
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

      {/* SPECIFICATIONS */}
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
          <Text style={styles.value}>{formatINR(resolved.price)} per {unitName}</Text>
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
      </View>

      {/* QUANTITY SELECTOR & SUMMARY */}
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
            <Text style={styles.label}>Price per {unitName}</Text>
            <Text style={styles.value}>{formatINR(resolved.price)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Calculated Subtotal ({quantity} {unitName}s)</Text>
            <Text style={styles.subtotalText}>{formatINR(subtotal)}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <AppButton
            title={inCart > 0 ? `Update Cart (${quantity} ${unitName}s)` : `Add ${quantity} ${unitName}${quantity === 1 ? '' : 's'} to Cart`}
            icon={inCart > 0 ? 'cart-check' : 'cart-plus'}
            loading={isCartPending}
            onPress={addOrUpdateCart}
            disabled={isOutOfStock}
          />
          <AppButton
            title="Buy Now / Checkout"
            icon="flash"
            variant="secondary"
            onPress={handleBuyNow}
            disabled={isOutOfStock || isCartPending}
          />
        </View>
      </View>

      {/* RELATED PRODUCTS */}
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.card
  },
  image: {
    width: '100%',
    height: 240,
    backgroundColor: colors.cardAlt
  },
  noImageWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40
  },
  noImage: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  },
  wishlistBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating
  },
  stockFloatingBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  stockFloatingText: {
    fontSize: 11,
    fontWeight: '800'
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
    ...shadows.card
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  categoryPill: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  categoryPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  packPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  packPillText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800'
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900'
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2
  },
  currencySymbol: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900'
  },
  priceText: {
    color: colors.navy,
    fontSize: 26,
    fontWeight: '900'
  },
  unitText: {
    color: colors.textMuted,
    fontSize: 13,
    marginLeft: 3
  },
  discountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  discountText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800'
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 20
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13
  },
  value: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '800'
  },
  outOfStockText: {
    color: colors.danger
  },
  inCart: {
    color: colors.textSecondary,
    fontSize: 13
  },
  qtyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  qtyButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  counterPill: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.infoBorder,
    borderRadius: radius.md,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    paddingVertical: 8
  },
  counterLabel: {
    color: colors.primaryPressed,
    fontSize: 10.5,
    fontWeight: '800'
  },
  counterValue: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '900'
  },
  pricingSummary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
    backgroundColor: colors.cardAlt
  },
  subtotalText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900'
  },
  actionButtons: {
    gap: 8,
    marginTop: 6
  },
  relatedSection: {
    marginTop: 8,
    gap: 10
  },
  relatedTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.navy
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10
  },
  relatedCell: {
    width: '48%'
  }
});
