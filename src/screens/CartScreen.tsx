import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput as NativeTextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BeverageLoader } from '../components/BeverageLoader';
import { EmptyState, LoadingView } from '../components/StateViews';
import { API_BASE_URL, api } from '../constants/api';
import { CartItem, SavedAddress } from '../constants/types';
import { colors, radius, shadows } from '../constants/theme';
import { useNetwork } from '../contexts/NetworkContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { clearCart, fetchCart, hydrateCart, removeCartItem, updateCartItem } from '../redux/slices/cartSlice';
import { placeOrder } from '../redux/slices/orderSlice';
import { getLinePricing } from '../utils/pricing';
import { formatINR } from '../utils/currency';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

const resolveImageUrl = (raw?: string) => {
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  return `${API_BASE_URL.replace('/api', '')}${str}`;
};

type CartRowProps = {
  item: CartItem;
  isPending?: boolean;
  onIncrement: (item: CartItem) => void;
  onDecrement: (item: CartItem) => void;
  onRemove: (item: CartItem) => void;
};

const CartRow = memo(({ item, isPending = false, onIncrement, onDecrement, onRemove }: CartRowProps) => {
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
            {formatINR(line.unitPrice)} / {unit} • Min: {moq}
          </Text>
          <Text style={styles.lineTotal}>{formatINR(line.subtotal)}</Text>
          {line.savings > 0 ? (
            <Text style={styles.savings}>Bulk savings: -{formatINR(line.savings)}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel={`Remove ${item.product.name} from cart`}
          onPress={() => onRemove(item)}
          disabled={isPending}
          style={[styles.removeButton, isPending && { opacity: 0.5 }]}
          hitSlop={8}
        >
          {isPending ? (
            <ActivityIndicator size="small" color={colors.danger} style={{ transform: [{ scale: 0.7 }] }} />
          ) : (
            <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.danger} />
          )}
        </Pressable>
      </View>

      <View style={styles.qtyRow}>
        <Text style={styles.qtyLabel}>Quantity ({unit}s)</Text>
        <View style={styles.qtyControls}>
          <Pressable
            accessibilityLabel="Decrease quantity"
            onPress={() => onDecrement(item)}
            disabled={isPending}
            style={[styles.qtyButton, isPending && { opacity: 0.5 }]}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="minus" size={17} color={colors.primary} />
          </Pressable>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <Pressable
            accessibilityLabel="Increase quantity"
            onPress={() => onIncrement(item)}
            disabled={isPending}
            style={[styles.qtyButton, styles.qtyButtonPrimary, isPending && { opacity: 0.5 }]}
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
  const { colors, isDark } = useTheme();
  const { isOnline } = useNetwork();
  const { items, loading, pendingItems = {} } = useAppSelector((state) => state.cart);
  const { user } = useAppSelector((state) => state.auth);
  const { error } = useAppSelector((state) => state.orders);

  // Saved Addresses & Delivery Flow State
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [isAddressConfirmed, setIsAddressConfirmed] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Address Modals State
  const [changeAddressModalVisible, setChangeAddressModalVisible] = useState(false);
  const [addAddressModalVisible, setAddAddressModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);

  // Add/Edit Address Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLine1, setFormLine1] = useState('');
  const [formLine2, setFormLine2] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formLandmark, setFormLandmark] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [placedOrderRef, setPlacedOrderRef] = useState<string>('');

  const loadUserAddresses = useCallback(async () => {
    if (!user) return;
    setLoadingAddresses(true);
    try {
      const res = await api.get('/users/addresses');
      const addrs: SavedAddress[] = res.data.data || [];
      setSavedAddresses(addrs);
      if (addrs.length > 0) {
        const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
        setSelectedAddress(defaultAddr);
      } else {
        setSelectedAddress(null);
      }
    } catch (err: any) {
      console.error('Failed to load user addresses:', err?.message);
    } finally {
      setLoadingAddresses(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      dispatch(hydrateCart());
      dispatch(fetchCart());
      loadUserAddresses();
    }
  }, [dispatch, user, loadUserAddresses]);

  const onRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (user) {
        await Promise.all([dispatch(fetchCart()), loadUserAddresses()]);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, dispatch, user, loadUserAddresses]);

  const handleUseThisAddress = () => {
    haptics.successNotification();
    setIsAddressConfirmed(true);
    toast.success('Address confirmed for delivery');
  };

  const handleSelectAddressFromModal = (addr: SavedAddress) => {
    haptics.selection();
    setSelectedAddress(addr);
    setIsAddressConfirmed(true);
    setChangeAddressModalVisible(false);
    toast.success(`Delivering to ${addr.fullName}`);
  };

  const openAddAddressModal = () => {
    haptics.lightImpact();
    setEditingAddress(null);
    setFormName(user?.name || '');
    setFormPhone(user?.phone || '');
    setFormLine1('');
    setFormLine2('');
    setFormCity('');
    setFormState('');
    setFormPin('');
    setFormLandmark('');
    setFormIsDefault(savedAddresses.length === 0);
    setChangeAddressModalVisible(false);
    setAddAddressModalVisible(true);
  };

  const openEditAddressModal = (addr: SavedAddress) => {
    haptics.lightImpact();
    setEditingAddress(addr);
    setFormName(addr.fullName || '');
    setFormPhone(addr.phone || '');
    setFormLine1(addr.addressLine1 || '');
    setFormLine2(addr.addressLine2 || '');
    setFormCity(addr.city || '');
    setFormState(addr.state || '');
    setFormPin(addr.postalCode || '');
    setFormLandmark(addr.landmark || '');
    setFormIsDefault(Boolean(addr.isDefault));
    setChangeAddressModalVisible(false);
    setAddAddressModalVisible(true);
  };

  const handleSaveAddressForm = async () => {
    const trimmedName = formName.trim();
    const cleanPhone = formPhone.replace(/[^0-9]/g, '');
    const trimmedLine1 = formLine1.trim();
    const trimmedLine2 = formLine2.trim();
    const trimmedCity = formCity.trim();
    const trimmedState = formState.trim();
    const cleanPin = formPin.replace(/[^0-9]/g, '');
    const trimmedLandmark = formLandmark.trim();

    if (!trimmedName) {
      haptics.errorNotification();
      Alert.alert('Missing Name', 'Please enter recipient / contact name.');
      return;
    }
    if (cleanPhone.length < 10) {
      haptics.errorNotification();
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!trimmedLine1) {
      haptics.errorNotification();
      Alert.alert('Missing Address Line 1', 'Please enter House / Shop / Street / Building.');
      return;
    }
    if (!trimmedCity) {
      haptics.errorNotification();
      Alert.alert('Missing City', 'Please enter city.');
      return;
    }
    if (!trimmedState) {
      haptics.errorNotification();
      Alert.alert('Missing State', 'Please enter state.');
      return;
    }
    if (cleanPin.length !== 6) {
      haptics.errorNotification();
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit postal PIN code.');
      return;
    }

    setSavingAddress(true);
    haptics.mediumImpact();

    const payload = {
      fullName: trimmedName,
      phone: cleanPhone,
      addressLine1: trimmedLine1,
      addressLine2: trimmedLine2,
      city: trimmedCity,
      state: trimmedState,
      postalCode: cleanPin,
      country: 'India',
      landmark: trimmedLandmark,
      isDefault: formIsDefault
    };

    try {
      if (editingAddress?._id || editingAddress?.id) {
        const id = editingAddress._id || editingAddress.id;
        const res = await api.put(`/users/addresses/${id}`, payload);
        const updatedList: SavedAddress[] = res.data.data?.addresses || [];
        setSavedAddresses(updatedList);
        const current = updatedList.find((a) => (a._id || a.id) === id) || res.data.data?.address;
        if (current) setSelectedAddress(current);
        setIsAddressConfirmed(true);
        toast.success('Address updated successfully');
      } else {
        const res = await api.post('/users/addresses', payload);
        const updatedList: SavedAddress[] = res.data.data?.addresses || [];
        setSavedAddresses(updatedList);
        const newlyAdded = res.data.data?.address || updatedList[updatedList.length - 1];
        if (newlyAdded) setSelectedAddress(newlyAdded);
        setIsAddressConfirmed(true);
        toast.success('New address saved & selected for delivery');
      }
      setAddAddressModalVisible(false);
    } catch (err: any) {
      haptics.errorNotification();
      toast.error(err?.response?.data?.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

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
      if (pendingItems[item.product._id]) return;
      if (item.quantity >= item.product.stock) {
        haptics.errorNotification();
        toast.show(`Only ${item.product.stock} cases available in stock.`, 'error');
        return;
      }
      haptics.selection();
      try {
        await dispatch(updateCartItem({ productId: item.product._id, quantity: item.quantity + 1 })).unwrap();
      } catch (err: any) {
        haptics.errorNotification();
        toast.show(err || 'Failed to update case quantity', 'error');
      }
    },
    [dispatch, pendingItems]
  );

  const onDecrement = useCallback(
    async (item: CartItem) => {
      if (pendingItems[item.product._id]) return;
      const moq = Math.max(1, item.product.minOrderQuantity || 1);
      if (item.quantity - 1 < moq) {
        haptics.lightImpact();
        toast.show(`Minimum order is ${moq} cases. Remove item if not needed.`, 'info');
        return;
      }
      haptics.selection();
      try {
        await dispatch(updateCartItem({ productId: item.product._id, quantity: item.quantity - 1 })).unwrap();
      } catch (err: any) {
        haptics.errorNotification();
        toast.show(err || 'Failed to update case quantity', 'error');
      }
    },
    [dispatch, pendingItems]
  );

  const onRemove = useCallback(
    async (item: CartItem) => {
      if (pendingItems[item.product._id]) return;
      haptics.lightImpact();
      try {
        await dispatch(removeCartItem(item.product._id)).unwrap();
        toast.show(`${item.product.name} removed from cart.`, 'success');
      } catch (err: any) {
        haptics.errorNotification();
        toast.show(err || 'Failed to remove item', 'error');
      }
    },
    [dispatch, pendingItems]
  );

  const handlePlaceOrder = async () => {
    if (submittingOrder) return;

    if (!isOnline) {
      haptics.errorNotification();
      toast.show('No internet connection. Please reconnect and try again.', 'error');
      return;
    }

    if (!selectedAddress) {
      haptics.errorNotification();
      Alert.alert('Delivery Address Required', 'Please select or add a delivery address before placing order.', [
        { text: '+ Add Address', onPress: openAddAddressModal }
      ]);
      return;
    }

    const trimmedName = selectedAddress.fullName.trim();
    const cleanPhone = selectedAddress.phone.replace(/[^0-9]/g, '');
    const trimmedLine1 = selectedAddress.addressLine1.trim();
    const trimmedLine2 = (selectedAddress.addressLine2 || '').trim();
    const trimmedCity = selectedAddress.city.trim();
    const trimmedState = selectedAddress.state.trim();
    const cleanPin = (selectedAddress.postalCode || '').replace(/[^0-9]/g, '');
    const country = selectedAddress.country || 'India';

    if (!trimmedName || cleanPhone.length < 10 || !trimmedLine1 || !trimmedCity || !trimmedState || cleanPin.length !== 6) {
      haptics.errorNotification();
      Alert.alert('Incomplete Address', 'Please edit your delivery address to ensure complete contact and postal details.');
      return;
    }

    const formattedAddress = [
      trimmedLine1,
      trimmedLine2,
      selectedAddress.landmark ? `Landmark: ${selectedAddress.landmark.trim()}` : '',
      `${trimmedCity}, ${trimmedState} - ${cleanPin}`,
      country
    ]
      .filter(Boolean)
      .join(', ');

    setSubmittingOrder(true);
    haptics.mediumImpact();
    const idempotencyKey = `${user?.id || 'b2b'}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    try {
      const placed = await dispatch(
        placeOrder({
          customerName: trimmedName,
          phoneNumber: cleanPhone,
          shippingAddress: formattedAddress,
          deliveryAddress: {
            contactName: trimmedName,
            fullName: trimmedName,
            phone: cleanPhone,
            addressLine1: trimmedLine1,
            addressLine2: trimmedLine2,
            city: trimmedCity,
            state: trimmedState,
            pincode: cleanPin,
            postalCode: cleanPin,
            country,
            landmark: selectedAddress.landmark || '',
            notes: orderNotes.trim()
          },
          deliveryAddressDetails: {
            contactName: trimmedName,
            fullName: trimmedName,
            phone: cleanPhone,
            addressLine1: trimmedLine1,
            addressLine2: trimmedLine2,
            city: trimmedCity,
            state: trimmedState,
            pincode: cleanPin,
            postalCode: cleanPin,
            country,
            landmark: selectedAddress.landmark || '',
            notes: orderNotes.trim()
          },
          notes: orderNotes.trim(),
          idempotencyKey
        })
      ).unwrap();

      const orderIdStr = String(placed?._id || '').slice(-6).toUpperCase();
      setPlacedOrderRef(orderIdStr || 'CONFIRMED');

      haptics.successNotification();
      setSuccessModalVisible(true);
      dispatch(clearCart());
      setOrderNotes('');

      toast.show('Order placed successfully! A confirmation email has been sent.', 'success', 'Order Confirmed');
    } catch {
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
          <Text style={styles.headerTitle}>Wholesale Cart</Text>
          <Text style={styles.headerSubtitle}>
            {items.length
              ? `${items.length} product line${items.length === 1 ? '' : 's'} (${summary.totalCases} units)`
              : 'Review your bulk wholesale order'}
          </Text>
        </View>
      </View>
    ),
    [navigation, items.length, summary.totalCases]
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="lock-outline"
            title="Sign In Required"
            description="Sign in or create a wholesale trade account to build your cart, calculate tax, and place orders."
            actionLabel="Sign In"
            onAction={() => navigation.navigate('Login')}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        <LoadingView label="Loading your beverage cart..." />
      </SafeAreaView>
    );
  }

  if (!items.length && !successModalVisible) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
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
              isPending={Boolean(pendingItems[item.product._id])}
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
              <Text style={styles.summaryValue}>{formatINR(summary.subtotal + summary.savings)}</Text>
            </View>

            {summary.savings > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Wholesale Discount:</Text>
                <Text style={styles.savingsText}>-{formatINR(summary.savings)}</Text>
              </View>
            ) : null}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>B2B Delivery Fee:</Text>
              <Text style={[styles.summaryValue, { color: '#16A34A', fontWeight: '800' }]}>FREE</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.grandLabel}>Total Order Amount:</Text>
              <Text style={styles.grandValue}>{formatINR(summary.subtotal)}</Text>
            </View>
          </View>

          {/* DELIVERY & CHECKOUT CARD */}
          <View style={styles.formCard}>
            <View style={styles.cardHeadingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {savedAddresses.length === 0
                    ? 'Add a delivery address'
                    : isAddressConfirmed
                    ? '✓ Delivering to'
                    : 'Deliver to this address?'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {savedAddresses.length === 0
                    ? 'Add your wholesale warehouse or store address'
                    : isAddressConfirmed
                    ? 'Address confirmed for wholesale dispatch'
                    : 'Confirm this address or select a different one'}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={isAddressConfirmed ? 'check-circle' : 'truck-delivery-outline'}
                size={24}
                color={isAddressConfirmed ? colors.success : colors.primary}
              />
            </View>

            {/* CASE 1: FIRST TIME USER (0 SAVED ADDRESSES) */}
            {savedAddresses.length === 0 && !selectedAddress && (
              <View style={styles.noAddressCard}>
                <View style={styles.noAddressIconCircle}>
                  <MaterialCommunityIcons name="map-marker-plus-outline" size={32} color={colors.primary} />
                </View>
                <Text style={styles.noAddressTitle}>No Saved Delivery Address</Text>
                <Text style={styles.noAddressSub}>
                  Please add your wholesale delivery address to proceed with your order.
                </Text>
                <TouchableOpacity
                  style={styles.addNewAddressMainBtn}
                  onPress={openAddAddressModal}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                  <Text style={styles.addNewAddressMainBtnText}>+ Add New Address</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CASE 2: RETURNING USER - INITIAL PROMPT (UNCONFIRMED) */}
            {selectedAddress && !isAddressConfirmed && (
              <View style={styles.promptAddressCard}>
                {selectedAddress.isDefault ? (
                  <View style={styles.defaultBadgePill}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                    <Text style={styles.defaultBadgeText}>DEFAULT ADDRESS</Text>
                  </View>
                ) : (
                  <View style={[styles.defaultBadgePill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <Ionicons name="bookmark" size={12} color={colors.primary} />
                    <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>SAVED ADDRESS</Text>
                  </View>
                )}

                <View style={styles.promptAddressDetails}>
                  <Text style={styles.promptRecipientName}>{selectedAddress.fullName}</Text>
                  <Text style={styles.promptPhone}>+91 {selectedAddress.phone}</Text>

                  <Text style={styles.promptAddressLine1}>{selectedAddress.addressLine1}</Text>
                  {selectedAddress.addressLine2 ? (
                    <Text style={styles.promptAddressLine2}>{selectedAddress.addressLine2}</Text>
                  ) : null}
                  {selectedAddress.landmark ? (
                    <Text style={styles.promptLandmark}>Landmark: {selectedAddress.landmark}</Text>
                  ) : null}
                  <Text style={styles.promptCityStatePin}>
                    {selectedAddress.city}, {selectedAddress.state} - <Text style={{ fontWeight: '800' }}>{selectedAddress.postalCode}</Text>
                  </Text>
                  <Text style={styles.promptCountry}>{selectedAddress.country || 'India'}</Text>
                </View>

                {/* PROMPT ACTION BUTTONS */}
                <View style={styles.promptActionsRow}>
                  <TouchableOpacity
                    style={styles.useThisAddressBtn}
                    onPress={handleUseThisAddress}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="checkmark" size={18} color={colors.white} />
                    <Text style={styles.useThisAddressBtnText}>Use This Address</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.changeAddressBtn}
                    onPress={() => setChangeAddressModalVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.changeAddressBtnText}>Change Address</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* CASE 3: CONFIRMED ADDRESS CARD */}
            {selectedAddress && isAddressConfirmed && (
              <View style={styles.confirmedAddressCard}>
                <View style={styles.confirmedTopRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.confirmedNameRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={styles.confirmedRecipientName}>{selectedAddress.fullName}</Text>
                      <Text style={styles.confirmedPhone}>• +91 {selectedAddress.phone}</Text>
                    </View>
                    <Text style={styles.confirmedAddressText} numberOfLines={2}>
                      {selectedAddress.addressLine1}
                      {selectedAddress.addressLine2 ? `, ${selectedAddress.addressLine2}` : ''}
                    </Text>
                    <Text style={styles.confirmedCityPin}>
                      {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.postalCode}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.confirmedChangeBtn}
                    onPress={() => setChangeAddressModalVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.confirmedChangeBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* OPTIONAL WHOLESALE NOTES */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Delivery Instructions (Optional)</Text>
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
              disabled={submittingOrder || !selectedAddress}
              style={({ pressed }) => [
                styles.checkoutButton,
                (submittingOrder || !selectedAddress) && { opacity: 0.65 },
                pressed && { backgroundColor: colors.primaryPressed }
              ]}
            >
              <MaterialCommunityIcons name="truck-fast" size={20} color={colors.white} />
              <Text style={styles.checkoutButtonText}>
                {submittingOrder
                  ? 'Processing Order…'
                  : !selectedAddress
                  ? 'Select Address to Place Order'
                  : `Place Wholesale Order  •  ${formatINR(summary.subtotal)}`}
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

      {/* MODAL 1: CHOOSE DELIVERY ADDRESS */}
      <Modal
        visible={changeAddressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChangeAddressModalVisible(false)}
      >
        <View style={styles.modalSheetBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Choose Delivery Address</Text>
                <Text style={styles.modalSheetSubtitle}>Select an address for this wholesale order</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircle}
                onPress={() => setChangeAddressModalVisible(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalAddressList} showsVerticalScrollIndicator={false}>
              {savedAddresses.map((addr, idx) => {
                const addrId = addr._id || addr.id || String(idx);
                const isCurrentSelected = (selectedAddress?._id || selectedAddress?.id) === addrId;
                const isDefault = Boolean(addr.isDefault);

                return (
                  <View
                    key={addrId}
                    style={[
                      styles.modalAddressCard,
                      isCurrentSelected && styles.modalAddressCardSelected
                    ]}
                  >
                    <View style={styles.modalAddressCardTop}>
                      <View style={styles.modalAddressCardTopLeft}>
                        <Text style={styles.modalAddressName}>{addr.fullName}</Text>
                        <Text style={styles.modalAddressPhone}>+91 {addr.phone}</Text>
                      </View>
                      <View style={styles.modalAddressBadges}>
                        {isDefault ? (
                          <View style={styles.modalDefaultBadge}>
                            <Text style={styles.modalDefaultBadgeText}>✓ DEFAULT</Text>
                          </View>
                        ) : null}
                        {isCurrentSelected ? (
                          <View style={styles.modalSelectedBadge}>
                            <Text style={styles.modalSelectedBadgeText}>SELECTED</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.modalAddressLines}>
                      {addr.addressLine1}
                      {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                    </Text>
                    {addr.landmark ? (
                      <Text style={styles.modalAddressLandmark}>Landmark: {addr.landmark}</Text>
                    ) : null}
                    <Text style={styles.modalAddressCityState}>
                      {addr.city}, {addr.state} - <Text style={{ fontWeight: '800' }}>{addr.postalCode}</Text>
                    </Text>

                    {/* CARD ACTIONS */}
                    <View style={styles.modalCardActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.modalCardSelectBtn,
                          isCurrentSelected && styles.modalCardSelectBtnActive
                        ]}
                        onPress={() => handleSelectAddressFromModal(addr)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={isCurrentSelected ? 'checkmark-circle' : 'checkmark'}
                          size={16}
                          color={isCurrentSelected ? colors.white : colors.primary}
                        />
                        <Text
                          style={[
                            styles.modalCardSelectBtnText,
                            isCurrentSelected && styles.modalCardSelectBtnTextActive
                          ]}
                        >
                          {isCurrentSelected ? 'Using This Address' : 'Use This Address'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.modalCardEditBtn}
                        onPress={() => openEditAddressModal(addr)}
                        activeOpacity={0.85}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.textSecondary} />
                        <Text style={styles.modalCardEditBtnText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {/* ADD NEW ADDRESS ACTION IN MODAL */}
              <TouchableOpacity
                style={styles.modalAddNewBtn}
                onPress={openAddAddressModal}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.modalAddNewBtnText}>+ Add New Address</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: ADD / EDIT ADDRESS FORM */}
      <Modal
        visible={addAddressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddAddressModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalSheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>
                  {editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}
                </Text>
                <Text style={styles.modalSheetSubtitle}>
                  {editingAddress ? 'Update saved delivery details' : 'Save for wholesale delivery & orders'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircle}
                onPress={() => setAddAddressModalVisible(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* RECIPIENT NAME */}
              <View style={styles.modalFormField}>
                <Text style={styles.inputLabel}>Contact / Recipient Name *</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="account-outline" size={18} color={colors.textMuted} />
                  <NativeTextInput
                    style={styles.textInput}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="Full name (e.g. Vicky)"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* PHONE NUMBER */}
              <View style={styles.modalFormField}>
                <Text style={styles.inputLabel}>10-Digit Mobile Number *</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="phone-outline" size={18} color={colors.textMuted} />
                  <NativeTextInput
                    style={styles.textInput}
                    value={formPhone}
                    onChangeText={setFormPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder="10-digit phone number"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* ADDRESS LINE 1 */}
              <View style={styles.modalFormField}>
                <Text style={styles.inputLabel}>Address Line 1 (House / Shop / Street) *</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="home-outline" size={18} color={colors.textMuted} />
                  <NativeTextInput
                    style={styles.textInput}
                    value={formLine1}
                    onChangeText={setFormLine1}
                    placeholder="House / Shop / Street / Building"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* ADDRESS LINE 2 */}
              <View style={styles.modalFormField}>
                <Text style={styles.inputLabel}>Address Line 2 (Area / Locality)</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={colors.textMuted} />
                  <NativeTextInput
                    style={styles.textInput}
                    value={formLine2}
                    onChangeText={setFormLine2}
                    placeholder="Area, Colony, Road (Optional)"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* LANDMARK */}
              <View style={styles.modalFormField}>
                <Text style={styles.inputLabel}>Landmark (Optional)</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.textMuted} />
                  <NativeTextInput
                    style={styles.textInput}
                    value={formLandmark}
                    onChangeText={setFormLandmark}
                    placeholder="Nearby landmark (Optional)"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* CITY & STATE */}
              <View style={styles.rowFields}>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="city" size={17} color={colors.textMuted} />
                    <NativeTextInput
                      style={styles.textInput}
                      value={formCity}
                      onChangeText={setFormCity}
                      placeholder="e.g. Patna"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>State *</Text>
                  <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="map-outline" size={17} color={colors.textMuted} />
                    <NativeTextInput
                      style={styles.textInput}
                      value={formState}
                      onChangeText={setFormState}
                      placeholder="e.g. Bihar"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </View>

              {/* PINCODE & COUNTRY */}
              <View style={styles.rowFields}>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>PIN Code (6 digits) *</Text>
                  <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="numeric" size={18} color={colors.textMuted} />
                    <NativeTextInput
                      style={styles.textInput}
                      value={formPin}
                      onChangeText={(val) => setFormPin(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="800001"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>Country</Text>
                  <View style={[styles.inputWrap, { backgroundColor: colors.cardAlt }]}>
                    <MaterialCommunityIcons name="flag-outline" size={17} color={colors.textMuted} />
                    <NativeTextInput
                      style={[styles.textInput, { color: colors.textSecondary }]}
                      value="India"
                      editable={false}
                    />
                  </View>
                </View>
              </View>

              {/* DEFAULT SWITCH */}
              <View style={styles.saveAddressSwitchRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.saveAddressSwitchLabel}>Set as default delivery address</Text>
                  <Text style={styles.saveAddressSwitchSub}>Will be automatically pre-selected for future orders</Text>
                </View>
                <Switch
                  value={formIsDefault}
                  onValueChange={setFormIsDefault}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>

              {/* MODAL ACTION BUTTONS */}
              <View style={[styles.promptActionsRow, { marginTop: 14, marginBottom: 10 }]}>
                <TouchableOpacity
                  style={[styles.changeAddressBtn, { flex: 1 }]}
                  onPress={() => setAddAddressModalVisible(false)}
                >
                  <Text style={styles.changeAddressBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.useThisAddressBtn, { flex: 2 }, savingAddress && { opacity: 0.7 }]}
                  onPress={handleSaveAddressForm}
                  disabled={savingAddress}
                >
                  {savingAddress ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color={colors.white} />
                      <Text style={styles.useThisAddressBtnText}>Save & Use Address</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  rowFields: {
    flexDirection: 'row',
    gap: 10
  },
  halfField: {
    flex: 1,
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
  },
  noAddressCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4
  },
  noAddressIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  noAddressTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '900'
  },
  noAddressSub: {
    color: colors.textSecondary,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280
  },
  addNewAddressMainBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md
  },
  addNewAddressMainBtnText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '800'
  },
  promptAddressCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginVertical: 2
  },
  defaultBadgePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  defaultBadgeText: {
    color: colors.success,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  promptAddressDetails: {
    gap: 3
  },
  promptRecipientName: {
    color: colors.navy,
    fontSize: 16.5,
    fontWeight: '900'
  },
  promptPhone: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  promptAddressLine1: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 19
  },
  promptAddressLine2: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  promptLandmark: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic'
  },
  promptCityStatePin: {
    color: colors.text,
    fontSize: 13.5,
    marginTop: 2
  },
  promptCountry: {
    color: colors.textMuted,
    fontSize: 12
  },
  promptActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4
  },
  useThisAddressBtn: {
    flex: 1.4,
    minHeight: 44,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12
  },
  useThisAddressBtnText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '800'
  },
  changeAddressBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  changeAddressBtnText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700'
  },
  confirmedAddressCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    padding: 14,
    marginVertical: 2
  },
  confirmedTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  confirmedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  confirmedRecipientName: {
    color: '#14532D',
    fontSize: 14.5,
    fontWeight: '900'
  },
  confirmedPhone: {
    color: '#15803D',
    fontSize: 12.5,
    fontWeight: '700'
  },
  confirmedAddressText: {
    color: '#166534',
    fontSize: 12.5,
    lineHeight: 18
  },
  confirmedCityPin: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  confirmedChangeBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm
  },
  confirmedChangeBtnText: {
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: '800'
  },
  modalSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end'
  },
  modalSheetCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    maxHeight: '85%',
    gap: 14,
    ...shadows.modal
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalSheetTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900'
  },
  modalSheetSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1
  },
  modalCloseCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalAddressList: {
    maxHeight: 400
  },
  modalAddressCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 6
  },
  modalAddressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F8FAFC'
  },
  modalAddressCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  modalAddressCardTopLeft: {
    flex: 1
  },
  modalAddressName: {
    color: colors.navy,
    fontSize: 14.5,
    fontWeight: '900'
  },
  modalAddressPhone: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 1
  },
  modalAddressBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  modalDefaultBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  modalDefaultBadgeText: {
    color: colors.primary,
    fontSize: 9.5,
    fontWeight: '900'
  },
  modalSelectedBadge: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  modalSelectedBadgeText: {
    color: colors.success,
    fontSize: 9.5,
    fontWeight: '900'
  },
  modalAddressLines: {
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 18
  },
  modalAddressLandmark: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontStyle: 'italic'
  },
  modalAddressCityState: {
    color: colors.textSecondary,
    fontSize: 12
  },
  modalCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  modalCardSelectBtn: {
    flex: 1,
    minHeight: 38,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  modalCardSelectBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  modalCardSelectBtnText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '800'
  },
  modalCardSelectBtnTextActive: {
    color: colors.white
  },
  modalCardEditBtn: {
    minHeight: 38,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  modalCardEditBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  modalAddNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    backgroundColor: colors.infoSurface,
    marginTop: 4,
    marginBottom: 10
  },
  modalAddNewBtnText: {
    color: colors.primary,
    fontSize: 13.5,
    fontWeight: '800'
  },
  modalFormField: {
    gap: 6,
    marginBottom: 10
  },
  saveAddressSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginVertical: 4
  },
  saveAddressSwitchLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.text
  },
  saveAddressSwitchSub: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 1
  }
});
