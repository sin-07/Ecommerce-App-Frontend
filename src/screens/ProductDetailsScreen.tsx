import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from '../components/AppButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { API_BASE_URL } from '../constants/api';
import { ErrorView, LoadingView } from '../components/StateViews';
import { colors, radius, shadows } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { addCartItem, fetchCart, hydrateCart, updateCartItem } from '../redux/slices/cartSlice';
import { fetchProductById } from '../redux/slices/productSlice';
import { toast } from '../utils/toast';
import { getLinePricing, getPricingTiers } from '../utils/pricing';
import { getSmartDiscountSuggestion } from '../utils/suggestions';
import { SmartSuggestionBanner } from '../components/SmartSuggestionBanner';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetails'>;

export const ProductDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { productId, product } = route.params;
  const dispatch = useAppDispatch();
  const { selected, loading, error } = useAppSelector((state) => state.products);
  const { items: cartItems } = useAppSelector((state) => state.cart);

  const activeProduct = selected?._id === productId ? selected : product;
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

  const resolved = activeProduct?._id === productId ? activeProduct : selected;

  useEffect(() => {
    if (!resolved) return;

    const moq = Math.max(1, resolved.minOrderQuantity || 1);
    if (inCart > 0) {
      setQuantity(inCart);
      return;
    }
    setQuantity(moq);
  }, [resolved?._id, resolved?.minOrderQuantity, inCart]);

  if (loading && !resolved) return <LoadingView label="Fetching beverage details..." />;
  if (error && !resolved) return <ErrorView message={error} />;
  if (!resolved) return <ErrorView message="Beverage item unavailable" />;

  const imageUri = resolved.imageUrl
    ? resolved.imageUrl.startsWith('http')
      ? resolved.imageUrl
      : `${API_BASE_URL.replace('/api', '')}${resolved.imageUrl}`
    : '';

  const isOutOfStock = resolved.stock < 10;
  const moq = Math.max(1, resolved.minOrderQuantity || 1);
  const maxQty = Math.max(moq, resolved.stock || moq);
  const tiers = useMemo(() => getPricingTiers(resolved), [resolved]);
  const pricing = useMemo(() => getLinePricing(resolved, quantity), [resolved, quantity]);
  const suggestion = useMemo(() => getSmartDiscountSuggestion(resolved, quantity), [resolved, quantity]);

  const decrementQty = () => {
    setQuantity((prev) => Math.max(moq, prev - 1));
  };

  const incrementQty = () => {
    setQuantity((prev) => Math.min(maxQty, prev + 1));
  };

  const addOrUpdateCart = async () => {
    if (isOutOfStock) {
      toast.show('This beverage item is currently out of stock.', 'error');
      return;
    }

    if (quantity < moq) {
      toast.show(`Minimum wholesale order is ${moq} cases.`, 'error');
      return;
    }

    if (quantity > resolved.stock) {
      toast.show(`Only ${resolved.stock} cases available in warehouse.`, 'error');
      return;
    }

    try {
      if (inCart <= 0) {
        await dispatch(addCartItem({ productId: resolved._id, quantity })).unwrap();
        toast.show(`Added ${quantity} cases to wholesale cart.`, 'success');
      } else {
        await dispatch(updateCartItem({ productId: resolved._id, quantity })).unwrap();
        toast.show('Cart case quantity updated.', 'success');
      }
    } catch (cartError: any) {
      toast.show(cartError || 'Failed to update cart', 'error');
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.heroCard}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.noImageWrap}>
            <MaterialCommunityIcons name="bottle-soda-classic-outline" size={64} color={colors.primary} />
            <Text style={styles.noImage}>AP Enterprises Beverage Catalog</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{resolved.category || 'Soft Drinks'}</Text>
        </View>
        <Text style={styles.name}>{resolved.name}</Text>
        <Text style={styles.description}>{resolved.description}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Wholesale Specifications</Text>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Beverage Category</Text>
          <Text style={styles.value}>{resolved.category}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Case Price</Text>
          <Text style={styles.value}>${resolved.price.toFixed(2)} / case</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Available Inventory</Text>
          <Text style={[styles.value, isOutOfStock && styles.outOfStockText]}>
            {isOutOfStock ? 'Out of stock' : `${resolved.stock} cases in warehouse`}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Minimum Order Quantity</Text>
          <Text style={styles.value}>{resolved.minOrderQuantity} cases</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Tiered Volume Pricing</Text>
        {tiers.map((tier) => (
          <View key={tier.minQty} style={styles.detailRow}>
            <Text style={styles.label}>{tier.label}</Text>
            <Text style={styles.value}>${tier.unitPrice.toFixed(2)} / case</Text>
          </View>
        ))}
      </View>

      <SmartSuggestionBanner title={suggestion.title} message={suggestion.message} />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Order Cases</Text>
        <Text style={styles.inCart}>Select number of cases to add to your wholesale order:</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.qtyButton} activeOpacity={0.9} onPress={decrementQty}>
            <Text style={styles.qtyButtonText}>-</Text>
          </TouchableOpacity>
          <View style={styles.counterPill}>
            <Text style={styles.counterLabel}>Cases Selected</Text>
            <Text style={styles.counterValue}>{quantity}</Text>
          </View>
          <TouchableOpacity
            style={styles.qtyButton}
            activeOpacity={0.9}
            onPress={incrementQty}
            disabled={quantity >= maxQty}
          >
            <Text style={styles.qtyButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.pricingSummary}>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Unit Price per Case</Text>
            <Text style={styles.value}>${pricing.unitPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Subtotal</Text>
            <Text style={styles.value}>${pricing.subtotal.toFixed(2)}</Text>
          </View>
          {pricing.savings > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Volume Savings</Text>
              <Text style={styles.savings}>-${pricing.savings.toFixed(2)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.moqText}>MOQ: {moq} cases</Text>
        {inCart > 0 && <Text style={styles.moqText}>Currently in cart: {inCart} cases</Text>}
        <AppButton
          title={inCart > 0 ? 'Update Cart Quantity' : `Add ${quantity} Case${quantity === 1 ? '' : 's'} to Cart`}
          icon={inCart > 0 ? 'cart-check' : 'cart-plus'}
          onPress={addOrUpdateCart}
          disabled={isOutOfStock}
        />
        <AppButton
          title="View Beverage Cart"
          icon="cart-outline"
          variant="secondary"
          onPress={() => navigation.navigate('Cart')}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card
  },
  image: {
    width: '100%',
    height: 210,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt
  },
  noImageWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 30
  },
  noImage: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
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
  categoryPill: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
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
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21
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
    fontSize: 13,
    fontWeight: '600'
  },
  row: {
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
  qtyButtonText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800'
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
    fontSize: 11,
    fontWeight: '700'
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
  savings: {
    color: colors.success,
    fontSize: 13.5,
    fontWeight: '800'
  },
  moqText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  }
});
