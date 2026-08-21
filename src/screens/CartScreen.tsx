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

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(true);

  // Pre-fill customer details from profile
  const [contactName, setContactName] = useState(user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
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
        const addrId = defaultAddr._id || defaultAddr.id || '';
        setSelectedAddressId(addrId);
        setContactName(defaultAddr.fullName || user?.name || '');
        setPhoneNumber(defaultAddr.phone || user?.phone || '');
        setAddressLine1(defaultAddr.addressLine1 || '');
        setAddressLine2(defaultAddr.addressLine2 || '');
        setCity(defaultAddr.city || '');
        setState(defaultAddr.state || '');
        setPincode(defaultAddr.postalCode || '');
      } else {
        setSelectedAddressId('new');
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

  // Update pre-filled fields if user profile updates and no saved address was selected
  useEffect(() => {
    if (user?.name && !contactName && selectedAddressId === 'new') setContactName(user.name);
    if (user?.phone && !phoneNumber && selectedAddressId === 'new') setPhoneNumber(user.phone);
  }, [user?.name, user?.phone, selectedAddressId]);

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    haptics.selection();
    const addrId = addr._id || addr.id || '';
    setSelectedAddressId(addrId);
    setContactName(addr.fullName || '');
    setPhoneNumber(addr.phone || '');
    setAddressLine1(addr.addressLine1 || '');
    setAddressLine2(addr.addressLine2 || '');
    setCity(addr.city || '');
    setState(addr.state || '');
    setPincode(addr.postalCode || '');
  };

  const handleSelectNewAddress = () => {
    haptics.selection();
    setSelectedAddressId('new');
    setContactName(user?.name || '');
    setPhoneNumber(user?.phone || '');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('');
    setPincode('');
    setSaveAddressToProfile(true);
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

    const trimmedName = contactName.trim();
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const trimmedLine1 = addressLine1.trim();
    const trimmedLine2 = addressLine2.trim();
    const trimmedCity = city.trim();
    const trimmedState = state.trim();
    const cleanPin = pincode.replace(/[^0-9]/g, '');

    if (!trimmedName) {
      haptics.errorNotification();
      Alert.alert('Missing Contact Name', 'Please enter the delivery contact person name.');
      return;
    }
    if (cleanPhone.length < 10) {
      haptics.errorNotification();
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!trimmedLine1) {
      haptics.errorNotification();
      Alert.alert('Missing Address Line 1', 'Please enter House / Shop / Street / Building details.');
      return;
    }
    if (!trimmedCity) {
      haptics.errorNotification();
      Alert.alert('Missing City', 'Please enter the delivery city.');
      return;
    }
    if (!trimmedState) {
      haptics.errorNotification();
      Alert.alert('Missing State', 'Please enter the delivery state.');
      return;
    }
    if (cleanPin.length !== 6) {
      haptics.errorNotification();
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit postal PIN code.');
      return;
    }

    const formattedAddress = [
      trimmedLine1,
      trimmedLine2,
      `${trimmedCity}, ${trimmedState} - ${cleanPin}`,
      'India'
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
            phone: cleanPhone,
            addressLine1: trimmedLine1,
            addressLine2: trimmedLine2,
            city: trimmedCity,
            state: trimmedState,
            pincode: cleanPin,
            country: 'India',
            notes: orderNotes.trim()
          },
          deliveryAddressDetails: {
            contactName: trimmedName,
            phone: cleanPhone,
            addressLine1: trimmedLine1,
            addressLine2: trimmedLine2,
            city: trimmedCity,
            state: trimmedState,
            pincode: cleanPin,
            country: 'India',
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

      // Auto-save new address to profile if enabled
      if (selectedAddressId === 'new' && saveAddressToProfile && user) {
        api.post('/users/addresses', {
          fullName: trimmedName,
          phone: cleanPhone,
          addressLine1: trimmedLine1,
          addressLine2: trimmedLine2,
          city: trimmedCity,
          state: trimmedState,
          postalCode: cleanPin,
          country: 'India',
          isDefault: savedAddresses.length === 0
        })
          .then((res) => {
            setSavedAddresses(res.data.data?.addresses || []);
          })
          .catch((err) => console.error('Failed to auto-save address:', err?.message));
      }

      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setPincode('');
      setOrderNotes('');

      toast.show('Order placed successfully! A confirmation email has been sent.', 'success', 'Order Confirmed');
      setSuccessModalVisible(true);
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

          {/* DELIVERY & CHECKOUT FORM */}
          <View style={styles.formCard}>
            <View style={styles.cardHeadingRow}>
              <View>
                <Text style={styles.cardTitle}>Delivery Information</Text>
                <Text style={styles.cardSubtitle}>Wholesale order notification will be sent to {user?.email}</Text>
              </View>
              <MaterialCommunityIcons name="truck-delivery-outline" size={24} color={colors.primary} />
            </View>

            {/* SAVED ADDRESS SELECTOR CARDS */}
            {savedAddresses.length > 0 && (
              <View style={styles.savedAddressesSelectorSection}>
                <View style={styles.savedAddressesHeaderRow}>
                  <Text style={styles.savedAddressesSectionTitle}>Select Saved Address</Text>
                  <Text style={styles.savedAddressesSectionCount}>
                    {savedAddresses.length} address{savedAddresses.length === 1 ? '' : 'es'}
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.savedAddressesScroll}
                >
                  {savedAddresses.map((addr) => {
                    const addrId = addr._id || addr.id || '';
                    const isSelected = selectedAddressId === addrId;
                    const isDefault = Boolean(addr.isDefault);

                    return (
                      <TouchableOpacity
                        key={addrId}
                        style={[
                          styles.checkoutAddressCard,
                          isSelected && styles.checkoutAddressCardSelected
                        ]}
                        onPress={() => handleSelectSavedAddress(addr)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.checkoutAddrCardTop}>
                          <View style={styles.checkoutAddrNameCol}>
                            <Text style={styles.checkoutAddrName} numberOfLines={1}>
                              {addr.fullName}
                            </Text>
                            {isDefault ? (
                              <View style={styles.checkoutDefaultBadge}>
                                <Text style={styles.checkoutDefaultBadgeText}>DEFAULT</Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={[styles.checkoutRadioOuter, isSelected && styles.checkoutRadioOuterSelected]}>
                            {isSelected ? <View style={styles.checkoutRadioInner} /> : null}
                          </View>
                        </View>

                        <Text style={styles.checkoutAddrPhone}>+91 {addr.phone}</Text>
                        <Text style={styles.checkoutAddrLine} numberOfLines={2}>
                          {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                        </Text>
                        <Text style={styles.checkoutAddrCityState}>
                          {addr.city}, {addr.state} - <Text style={{ fontWeight: '800' }}>{addr.postalCode}</Text>
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* USE NEW ADDRESS CARD */}
                  <TouchableOpacity
                    style={[
                      styles.checkoutAddressCard,
                      styles.checkoutNewAddressCard,
                      selectedAddressId === 'new' && styles.checkoutAddressCardSelected
                    ]}
                    onPress={handleSelectNewAddress}
                    activeOpacity={0.85}
                  >
                    <View style={styles.checkoutNewAddrIconCircle}>
                      <Ionicons name="add" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.checkoutNewAddrTitle}>+ New Address</Text>
                    <Text style={styles.checkoutNewAddrSub}>Deliver elsewhere</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {/* CONTACT NAME */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Contact Name *</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="account-outline" size={18} color={colors.textMuted} />
                <NativeTextInput
                  style={styles.textInput}
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder="Enter contact person name (e.g. Vicky)"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* CONTACT PHONE */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="phone-outline" size={18} color={colors.textMuted} />
                <NativeTextInput
                  style={styles.textInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* ADDRESS LINE 1 */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Address Line 1 *</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="home-outline" size={18} color={colors.textMuted} />
                <NativeTextInput
                  style={styles.textInput}
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  placeholder="House / Shop / Street / Building"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* ADDRESS LINE 2 */}
            <View style={styles.formField}>
              <Text style={styles.inputLabel}>Address Line 2 (Optional)</Text>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={colors.textMuted} />
                <NativeTextInput
                  style={styles.textInput}
                  value={addressLine2}
                  onChangeText={setAddressLine2}
                  placeholder="Area / Landmark / Warehouse dock"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* CITY & STATE ROW */}
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>City *</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="city" size={17} color={colors.textMuted} />
                  <NativeTextInput
                    style={styles.textInput}
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
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
                    value={state}
                    onChangeText={setState}
                    placeholder="State"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </View>

            {/* PINCODE & COUNTRY ROW */}
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Pincode (6 digits) *</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="numeric" size={18} color={colors.textMuted} />
                  <NativeTextInput
                    style={styles.textInput}
                    value={pincode}
                    onChangeText={(val) => setPincode(val.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="6-digit PIN"
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

            {/* SAVE TO PROFILE CHECKBOX IF ENTERING NEW ADDRESS */}
            {selectedAddressId === 'new' && (
              <View style={styles.saveAddressSwitchRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.saveAddressSwitchLabel}>Save address for future wholesale orders</Text>
                  <Text style={styles.saveAddressSwitchSub}>Avoid re-entering delivery details on next order</Text>
                </View>
                <Switch
                  value={saveAddressToProfile}
                  onValueChange={setSaveAddressToProfile}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            )}

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
                {submittingOrder ? 'Processing Order…' : `Place Wholesale Order  •  ${formatINR(summary.subtotal)}`}
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
  savedAddressesSelectorSection: {
    gap: 8,
    marginBottom: 4
  },
  savedAddressesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  savedAddressesSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.navy
  },
  savedAddressesSectionCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600'
  },
  savedAddressesScroll: {
    gap: 10,
    paddingVertical: 4
  },
  checkoutAddressCard: {
    width: 220,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 12,
    gap: 4
  },
  checkoutAddressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.card
  },
  checkoutAddrCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  checkoutAddrNameCol: {
    flex: 1,
    paddingRight: 6
  },
  checkoutAddrName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.navy
  },
  checkoutDefaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.xs,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  checkoutDefaultBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.primary
  },
  checkoutRadioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  checkoutRadioOuterSelected: {
    borderColor: colors.primary
  },
  checkoutRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  checkoutAddrPhone: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  checkoutAddrLine: {
    fontSize: 11.5,
    color: colors.text,
    lineHeight: 16
  },
  checkoutAddrCityState: {
    fontSize: 11,
    color: colors.textMuted
  },
  checkoutNewAddressCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed'
  },
  checkoutNewAddrIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  checkoutNewAddrTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.primary
  },
  checkoutNewAddrSub: {
    fontSize: 10.5,
    color: colors.textMuted,
    textAlign: 'center'
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
