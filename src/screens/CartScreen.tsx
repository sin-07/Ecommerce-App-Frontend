import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BeverageLoader } from '../components/BeverageLoader';
import { EmptyState, LoadingView } from '../components/StateViews';
import { API_BASE_URL } from '../constants/api';
import { CartItem } from '../constants/types';
import { colors, radius, shadows } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { clearCart, fetchCart, hydrateCart, removeCartItem, updateCartItem } from '../redux/slices/cartSlice';
import { placeOrder } from '../redux/slices/orderSlice';
import { getLinePricing } from '../utils/pricing';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

const resolveImageUrl = (raw?: string) =>
  raw ? (raw.startsWith('http') ? raw : `${API_BASE_URL.replace('/api', '')}${raw}`) : '';

type CartRowProps = {
  item: CartItem;
  onIncrement: (item: CartItem) => void;
  onDecrement: (item: CartItem) => void;
  onRemove: (item: CartItem) => void;
};

const CartRow = memo(({ item, onIncrement, onDecrement, onRemove }: CartRowProps) => {
  const imageUrl = resolveImageUrl(item.product.imageUrl);
  const moq = Math.max(1, item.product.minOrderQuantity || 1);
  const unit = item.product.unit || 'unit';
  const line = getLinePricing(item.product, item.quantity);

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons
              name={item.product.category?.toLowerCase().includes('egg') ? 'egg-outline' : 'bottle-soda-classic-outline'}
              size={32}
              color={colors.primary}
            />
          </View>
        )}
        <View style={styles.itemMetaWrap}>
          <View style={styles.categoryRow}>
            <Text style={styles.itemCategory}>{item.product.category || 'General'}</Text>
            {item.product.packSize ? (
              <Text style={styles.packTag}>{item.product.packSize}</Text>
            ) : null}
          </View>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.product.name}
          </Text>
          <Text style={styles.itemMeta}>
            ₹{Number(line.unitPrice).toFixed(2)} / {unit} • Min: {moq}
          </Text>
          <Text style={styles.lineTotal}>₹{Number(line.subtotal).toFixed(2)}</Text>
          {line.savings > 0 ? (
            <Text style={styles.savings}>Bulk savings: -₹{Number(line.savings).toFixed(2)}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel={`Remove ${item.product.name} from cart`}
          onPress={() => onRemove(item)}
          style={styles.removeButton}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.danger} />
        </Pressable>
      </View>

      <View style={styles.qtyRow}>
        <Text style={styles.qtyLabel}>Quantity ({unit}s)</Text>
        <View style={styles.qtyControls}>
          <Pressable
            accessibilityLabel="Decrease quantity"
            onPress={() => onDecrement(item)}
            style={styles.qtyButton}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="minus" size={17} color={colors.primary} />
          </Pressable>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <Pressable
            accessibilityLabel="Increase quantity"
            onPress={() => onIncrement(item)}
            style={[styles.qtyButton, styles.qtyButtonPrimary]}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="plus" size={17} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

CartRow.displayName = 'CartRow';

export const CartScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { items, loading } = useAppSelector((state) => state.cart);
  const { user } = useAppSelector((state) => state.auth);
  const { error } = useAppSelector((state) => state.orders);

  // Pre-fill customer details from profile
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [shippingAddress, setShippingAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [placedOrderRef, setPlacedOrderRef] = useState<string>('');

  useEffect(() => {
    dispatch(hydrateCart());
    dispatch(fetchCart());
  }, [dispatch]);

  // Update pre-filled fields if user profile updates
  useEffect(() => {
    if (user?.name && !customerName) setCustomerName(user.name);
    if (user?.phone && !phoneNumber) setPhoneNumber(user.phone);
  }, [user?.name, user?.phone]);

  const summary = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          const line = getLinePricing(item.product, item.quantity);
          acc.subtotal += line.subtotal;
          acc.savings += line.savings;
          acc.totalCases += item.quantity;
          return acc;
        },
        { subtotal: 0, savings: 0, totalCases: 0 }
      ),
    [items]
  );

  const onIncrement = useCallback(
    async (item: CartItem) => {
      if (item.quantity >= item.product.stock) {
        toast.show(`Only ${item.product.stock} cases available in stock.`, 'error');
        return;
      }
      try {
        await dispatch(updateCartItem({ productId: item.product._id, quantity: item.quantity + 1 })).unwrap();
      } catch (err: any) {
        toast.show(err || 'Failed to update case quantity', 'error');
      }
    },
    [dispatch]
  );

  const onDecrement = useCallback(
    async (item: CartItem) => {
      const moq = Math.max(1, item.product.minOrderQuantity || 1);
      if (item.quantity - 1 < moq) {
        toast.show(`Minimum order is ${moq} cases. Remove item if not needed.`, 'info');
        return;
      }
      try {
        await dispatch(updateCartItem({ productId: item.product._id, quantity: item.quantity - 1 })).unwrap();
      } catch (err: any) {
        toast.show(err || 'Failed to update case quantity', 'error');
      }
    },
    [dispatch]
  );

  const onRemove = useCallback(
    async (item: CartItem) => {
      try {
        await dispatch(removeCartItem(item.product._id)).unwrap();
        toast.show(`${item.product.name} removed from cart.`, 'success');
      } catch (err: any) {
        toast.show(err || 'Failed to remove item', 'error');
      }
    },
    [dispatch]
  );

  const handlePlaceOrder = async () => {
    const trimmedName = customerName.trim();
    const trimmedPhone = phoneNumber.trim();
    const trimmedAddress = shippingAddress.trim();

    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please provide contact person name.');
      return;
    }
    if (!trimmedPhone) {
      Alert.alert('Missing Phone', 'Please provide a valid delivery contact phone number.');
      return;
    }
    if (!trimmedAddress || trimmedAddress.length < 5) {
      Alert.alert('Missing Address', 'Please provide complete delivery street address, city, and postal code.');
      return;
    }

    setSubmittingOrder(true);
    const start = Date.now();
    try {
      const placed = await dispatch(
        placeOrder({
          customerName: trimmedName,
          phoneNumber: trimmedPhone,
          shippingAddress: trimmedAddress,
          notes: orderNotes.trim()
        })
      ).unwrap();

      const elapsed = Date.now() - start;
      if (elapsed < 1800) {
        await new Promise((resolve) => setTimeout(() => resolve(true), 1800 - elapsed));
      }

      const orderIdStr = String(placed?._id || '').slice(-6).toUpperCase();
      setPlacedOrderRef(orderIdStr || 'CONFIRMED');

      dispatch(clearCart());
      setShippingAddress('');
      setOrderNotes('');

      toast.show('Order placed successfully! A confirmation email has been sent.', 'success', 'Order Confirmed');
      setSuccessModalVisible(true);
    } catch {
      const elapsed = Date.now() - start;
      if (elapsed < 1200) {
        await new Promise((resolve) => setTimeout(() => resolve(true), 1200 - elapsed));
      }
      Alert.alert('Order Failed', error || 'Unable to place order right now. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Beverage Cart</Text>
          <Text style={styles.headerSubtitle}>
            {items.length
              ? `${items.length} beverage item${items.length === 1 ? '' : 's'} (${summary.totalCases} cases)`
              : 'Review your bulk beverage order'}
          </Text>
        </View>
      </View>
    ),
    [navigation, items.length, summary.totalCases]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        <LoadingView label="Loading your beverage cart..." />
      </SafeAreaView>
    );
  }

  if (!items.length && !successModalVisible) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="bottle-soda-classic-outline"
            title="Your beverage cart is empty"
            description="Add beverage cases from the catalog to start your wholesale order."
            actionLabel="Browse Beverage Catalog"
            onAction={() => navigation.navigate('Home')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {header}
      <BeverageLoader visible={submittingOrder} mode="order" title="AP Enterprises" subtitle="Processing your bulk beverage order..." />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(30, insets.bottom + 24) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* CART ITEMS LIST */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Order Items</Text>
            <Text style={styles.sectionMeta}>{summary.totalCases} total cases</Text>
          </View>

          {items.map((item) => (
            <CartRow
              key={item.product._id}
              item={item}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
            />
          ))}

          {/* B2B ORDER SUMMARY CARD */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeadingRow}>
              <View>
                <Text style={styles.cardTitle}>Order Summary</Text>
                <Text style={styles.cardSubtitle}>AP Enterprises Wholesale Invoice</Text>
              </View>
              <MaterialCommunityIcons name="receipt-text-outline" size={24} color={colors.primary} />
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Quantity:</Text>
              <Text style={styles.summaryValue}>{summary.totalCases} items</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Base Subtotal:</Text>
              <Text style={styles.summaryValue}>₹{(summary.subtotal + summary.savings).toFixed(2)}</Text>
            </View>

            {summary.savings > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Wholesale Discount:</Text>
                <Text style={styles.savingsText}>-₹{summary.savings.toFixed(2)}</Text>
              </View>
            ) : null}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>B2B Delivery Fee:</Text>
              <Text style={[styles.summaryValue, { color: '#16A34A', fontWeight: '800' }]}>FREE</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.grandLabel}>Total Order Amount:</Text>
              <Text style={styles.grandValue}>₹{summary.subtotal.toFixed(2)}</Text>
            </View>
          </View>

          {/* DELIVERY & CHECKOUT FORM */}
          <View style={styles.formCard}>
            <View style={styles.cardHeadingRow}>
              <View>
                <Text style={styles.cardTitle}>Delivery Information</Text>
                <Text style={styles.cardSubtitle}>Order notification will be sent to {user?.email}</Text>
              </View>
              <MaterialCommunityIcons name="truck-delivery-outline" size={24} color={colors.primary} />
            </View>

            {/* PRE-FILLED FULL NAME */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Contact Name *</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="account-outline" size={18} color={colors.textMuted} />
                <NativeTextInput
                  style={styles.textInput}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Enter full contact name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* PRE-FILLED CONTACT PHONE */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="phone-outline" size={18} color={colors.textMuted} />
                <NativeTextInput
                  style={styles.textInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* SHIPPING ADDRESS */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Delivery Address *</Text>
              <View style={[styles.inputWrap, styles.multilineWrap]}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={18}
                  color={colors.textMuted}
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                />
                <NativeTextInput
                  style={[styles.textInput, styles.multilineInput]}
                  value={shippingAddress}
                  onChangeText={setShippingAddress}
                  multiline
                  numberOfLines={3}
                  placeholder="Street address, unit, warehouse dock, city, state, postal code"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* OPTIONAL NOTES */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Delivery Notes (Optional)</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="note-text-outline" size={18} color={colors.textMuted} />
                <NativeTextInput
                  style={styles.textInput}
                  value={orderNotes}
                  onChangeText={setOrderNotes}
                  placeholder="e.g. Forklift required, deliver before 2 PM"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* SUBMIT BUTTON */}
            <Pressable
              onPress={handlePlaceOrder}
              disabled={submittingOrder}
              style={({ pressed }) => [
                styles.checkoutButton,
                submittingOrder && { opacity: 0.7 },
                pressed && { backgroundColor: colors.primaryPressed }
              ]}
            >
              <MaterialCommunityIcons name="truck-fast" size={20} color={colors.white} />
              <Text style={styles.checkoutButtonText}>
                {submittingOrder ? 'Processing Order…' : `Place Wholesale Order  •  ₹${summary.subtotal.toFixed(2)}`}
              </Text>
            </Pressable>

            {/* CLEAR CART */}
            <Pressable onPress={() => dispatch(clearCart())} style={styles.clearButton} hitSlop={8}>
              <MaterialCommunityIcons name="delete-outline" size={17} color={colors.danger} />
              <Text style={styles.clearText}>Clear Cart</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ORDER SUCCESS MODAL */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <MaterialCommunityIcons name="check-decagram" size={48} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Order Confirmed! 🚚</Text>
            <View style={styles.orderRefPill}>
              <Text style={styles.orderRefText}>REF #{placedOrderRef}</Text>
            </View>
            <Text style={styles.successSubtitle}>
              Your bulk beverage order has been received by AP Enterprises. A detailed invoice has been sent to {user?.email}.
            </Text>

            <View style={styles.successActions}>
              <Pressable
                style={[styles.modalActionBtn, styles.modalPrimaryBtn]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  navigation.navigate('Orders');
                }}
              >
                <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={colors.white} />
                <Text style={styles.modalPrimaryBtnText}>Track Order & Fulfillment</Text>
              </Pressable>

              <Pressable
                style={[styles.modalActionBtn, styles.modalSecondaryBtn]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  navigation.navigate('Home');
                }}
              >
                <Text style={styles.modalSecondaryBtnText}>Continue Shopping</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '900'
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 1
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 60
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '900'
  },
  sectionMeta: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800'
  },
  itemCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
    ...shadows.card
  },
  itemTop: {
    flexDirection: 'row',
    gap: 12
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  itemMetaWrap: {
    flex: 1,
    gap: 2
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  packTag: {
    fontSize: 10.5,
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: '700'
  },
  itemCategory: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  itemName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800'
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: 11.5
  },
  lineTotal: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2
  },
  savings: {
    color: colors.success,
    fontSize: 11.5,
    fontWeight: '700'
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10
  },
  qtyLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  qtyButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  qtyButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  qtyValue: {
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900'
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
    ...shadows.card
  },
  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4
  },
  cardTitle: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '900'
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 13
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  savingsText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '800'
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4
  },
  grandLabel: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900'
  },
  grandValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900'
  },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    ...shadows.card
  },
  formField: {
    gap: 6
  },
  inputLabel: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '700'
  },
  inputWrap: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8
  },
  multilineWrap: {
    alignItems: 'flex-start',
    paddingVertical: 10
  },
  textInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top'
  },
  checkoutButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6
  },
  checkoutButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800'
  },
  clearButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2
  },
  clearText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  successCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 26,
    alignItems: 'center',
    ...shadows.modal
  },
  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  successTitle: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center'
  },
  orderRefPill: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  orderRefText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  successSubtitle: {
    color: colors.textSecondary,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20
  },
  successActions: {
    width: '100%',
    gap: 10
  },
  modalActionBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  modalPrimaryBtn: {
    backgroundColor: colors.primary
  },
  modalPrimaryBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800'
  },
  modalSecondaryBtn: {
    backgroundColor: colors.cardAlt
  },
  modalSecondaryBtnText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '700'
  }
});
