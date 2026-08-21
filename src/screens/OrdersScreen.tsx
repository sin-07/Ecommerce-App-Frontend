import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { EmptyState, ErrorView, LoadingView } from '../components/StateViews';
import { OrderCardSkeleton } from '../components/OrderCardSkeleton';
import { OrderStatusTimeline } from '../components/OrderStatusTimeline';
import { api, API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { Order, OrderItem, Product } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { addCartItem } from '../redux/slices/cartSlice';
import { fetchAdminOrders, fetchBuyerOrders, fetchSellerOrders, updateOrderStatus } from '../redux/slices/orderSlice';
import { formatINR } from '../utils/currency';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Orders'>;

const statusFlow = ['pending', 'packed', 'shipped', 'delivered'] as const;

const statusActionConfig: Record<
  string,
  { nextStatus: (typeof statusFlow)[number]; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; variant: 'primary' | 'success' }
> = {
  pending: { nextStatus: 'packed', label: 'Confirm Order (Pack Items)', icon: 'check-circle-outline', variant: 'primary' },
  processing: { nextStatus: 'packed', label: 'Confirm Order (Pack Items)', icon: 'check-circle-outline', variant: 'primary' },
  packed: { nextStatus: 'shipped', label: 'Dispatch Order (Notify Buyer)', icon: 'truck-fast-outline', variant: 'primary' },
  confirmed: { nextStatus: 'shipped', label: 'Dispatch Order (Notify Buyer)', icon: 'truck-fast-outline', variant: 'primary' },
  shipped: { nextStatus: 'delivered', label: 'Mark as Delivered', icon: 'check-decagram-outline', variant: 'success' },
  dispatched: { nextStatus: 'delivered', label: 'Mark as Delivered', icon: 'check-decagram-outline', variant: 'success' }
};

const statusLabel: Record<string, string> = {
  pending: 'Processing',
  processing: 'Processing',
  packed: 'Confirmed',
  confirmed: 'Confirmed',
  shipped: 'Dispatched',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

const statusTone = (status: string) => {
  const s = String(status || '').toLowerCase();
  switch (s) {
    case 'delivered':
      return { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857' };
    case 'cancelled':
      return { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' };
    case 'shipped':
    case 'dispatched':
      return { bg: '#E0F2FE', border: '#BAE6FD', text: '#0284C7' };
    case 'packed':
    case 'confirmed':
      return { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' };
    default:
      return { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' };
  }
};

const paymentStatusTone = (status: string) => {
  const s = String(status || 'DUE').toUpperCase();
  switch (s) {
    case 'PAID':
      return { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', label: 'PAID' };
    case 'PARTIALLY_PAID':
      return { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', label: 'PARTIALLY PAID' };
    default:
      return { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', label: 'DUE' };
  }
};

const getItemImageUrl = (item: OrderItem): string => {
  if (item.imageUrl) {
    return item.imageUrl.startsWith('http')
      ? item.imageUrl
      : `${API_BASE_URL.replace('/api', '')}${item.imageUrl}`;
  }
  if (typeof item.product === 'object' && item.product && item.product.imageUrl) {
    return item.product.imageUrl.startsWith('http')
      ? item.product.imageUrl
      : `${API_BASE_URL.replace('/api', '')}${item.product.imageUrl}`;
  }
  return '';
};

const getItemCategory = (item: OrderItem): string => {
  if (item.category) return item.category;
  if (typeof item.product === 'object' && item.product && item.product.category) {
    return item.product.category;
  }
  return 'Wholesale';
};

const getItemUnit = (item: OrderItem): string => {
  if (item.unit) return item.unit;
  if (typeof item.product === 'object' && item.product && item.product.unit) {
    return item.product.unit;
  }
  return 'unit';
};

export const OrdersScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { items, loading, error } = useAppSelector((state) => state.orders);
  const { user } = useAppSelector((state) => state.auth);

  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Cancellation Modals State
  const [cancelOrderModalVisible, setCancelOrderModalVisible] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelOrderReason, setCancelOrderReason] = useState('');
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  const [cancelItemModalVisible, setCancelItemModalVisible] = useState(false);
  const [cancellingItemOrder, setCancellingItemOrder] = useState<Order | null>(null);
  const [cancellingItem, setCancellingItem] = useState<OrderItem | null>(null);
  const [cancellingItemIndex, setCancellingItemIndex] = useState<number>(-1);
  const [cancelItemReason, setCancelItemReason] = useState('');
  const [isCancellingItem, setIsCancellingItem] = useState(false);

  const loadOrders = useCallback(
    async (isPullToRefresh = false) => {
      if (isPullToRefresh) {
        setRefreshing(true);
      } else if (items.length === 0) {
        setIsInitialLoading(true);
      }
      setFetchError(null);

      try {
        if (user?.role === 'buyer') {
          await dispatch(fetchBuyerOrders()).unwrap();
        } else if (user?.role === 'seller') {
          await dispatch(fetchSellerOrders()).unwrap();
        } else if (user?.role === 'admin') {
          await dispatch(fetchAdminOrders()).unwrap();
        } else {
          await dispatch(fetchBuyerOrders()).unwrap();
        }
      } catch (err: any) {
        const errorMsg = typeof err === 'string' ? err : err?.message || 'Unable to load wholesale orders.';
        setFetchError(errorMsg);
      } finally {
        setIsInitialLoading(false);
        setRefreshing(false);
      }
    },
    [dispatch, user?.role, items.length]
  );

  useEffect(() => {
    if (!user) {
      setIsInitialLoading(false);
      return;
    }
    loadOrders(false);
  }, [user, loadOrders]);

  const toggleExpand = (orderId: string) => {
    haptics.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: (typeof statusFlow)[number]) => {
    setUpdatingId(orderId);
    haptics.mediumImpact();
    try {
      await dispatch(updateOrderStatus({ id: orderId, status: nextStatus })).unwrap();
      toast.show(`Order status updated to ${nextStatus.toUpperCase()}`, 'success');
      loadOrders(true);
    } catch {
      toast.show('Failed to update status. Please try again.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkPaid = async (order: Order) => {
    haptics.mediumImpact();
    setUpdatingId(order._id);
    try {
      const activeItems = (order.items || []).filter((i) => i.status !== 'cancelled');
      const activeSubtotal = activeItems.reduce(
        (sum, i) => sum + (i.lineTotal !== undefined ? Number(i.lineTotal) : Number(i.unitPrice * i.quantity) || 0),
        0
      );
      const deliveryFee = Number(order.deliveryFee) || 0;
      const discount = Number(order.discount) || 0;
      const currentOrderTotal = Math.max(0, activeSubtotal + deliveryFee - discount);

      await dispatch(
        updateOrderStatus({
          id: order._id,
          status: order.status,
          amountPaid: currentOrderTotal,
          paymentStatus: 'PAID'
        })
      ).unwrap();
      toast.show('Payment marked as paid successfully.', 'success', 'Payment Received');
      loadOrders(true);
    } catch (err: any) {
      const errorMsg = typeof err === 'string' ? err : err?.message || 'Failed to update payment status.';
      toast.show(errorMsg, 'error', 'Payment Update Failed');
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Cancel Order Modal (Admin only)
  const openCancelOrderModal = (order: Order) => {
    haptics.lightImpact();
    setCancellingOrder(order);
    setCancelOrderReason('');
    setCancelOrderModalVisible(true);
  };

  // Confirm Admin Order Cancellation
  const handleConfirmCancelOrder = async () => {
    if (!cancellingOrder) return;
    const reasonTrimmed = cancelOrderReason.trim();
    if (!reasonTrimmed) {
      haptics.errorNotification();
      Alert.alert('Reason Required', 'Please enter a reason for cancelling this order so the customer is clearly notified.');
      return;
    }

    setIsCancellingOrder(true);
    haptics.mediumImpact();
    try {
      await api.patch(`/orders/${cancellingOrder._id}/cancel`, { reason: reasonTrimmed });
      toast.show('Order cancelled and customer notified', 'success', 'Order Cancelled');
      setCancelOrderModalVisible(false);
      loadOrders(true);
    } catch (err: any) {
      haptics.errorNotification();
      toast.show(err?.response?.data?.message || 'Failed to cancel order', 'error');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Open Cancel Item Modal (Admin only)
  const openCancelItemModal = (order: Order, item: OrderItem, index: number) => {
    haptics.lightImpact();
    setCancellingItemOrder(order);
    setCancellingItem(item);
    setCancellingItemIndex(index);
    setCancelItemReason('');
    setCancelItemModalVisible(true);
  };

  // Confirm Admin Item Cancellation
  const handleConfirmCancelItem = async () => {
    if (!cancellingItemOrder || !cancellingItem) return;
    const reasonTrimmed = cancelItemReason.trim();
    if (!reasonTrimmed) {
      haptics.errorNotification();
      Alert.alert('Reason Required', 'Please enter a cancellation reason for this product.');
      return;
    }

    setIsCancellingItem(true);
    haptics.mediumImpact();
    try {
      await api.patch(`/orders/${cancellingItemOrder._id}/cancel-item`, {
        itemId: cancellingItem._id,
        itemIndex: cancellingItemIndex,
        reason: reasonTrimmed
      });
      toast.show(`Item "${cancellingItem.name}" cancelled and stock restored`, 'success', 'Product Cancelled');
      setCancelItemModalVisible(false);
      loadOrders(true);
    } catch (err: any) {
      haptics.errorNotification();
      toast.show(err?.response?.data?.message || 'Failed to cancel item', 'error');
    } finally {
      setIsCancellingItem(false);
    }
  };

  const handleReorderEntireOrder = async (order: Order) => {
    if (!order.items || order.items.length === 0) return;
    setReorderingId(order._id);
    haptics.mediumImpact();

    try {
      let addedCount = 0;
      let unavailableCount = 0;

      for (const item of order.items) {
        if (item.status === 'cancelled') continue;
        const pid = typeof item.product === 'object' && item.product ? (item.product as any)._id : String(item.product);
        if (!pid) continue;

        try {
          const res = await api.get(`/products/${pid}`);
          const liveProd: Product = res.data?.data;
          if (!liveProd || !liveProd.isActive || liveProd.stock <= 0) {
            unavailableCount++;
            continue;
          }

          const moq = Math.max(1, liveProd.minOrderQuantity || 1);
          const targetQty = Math.max(moq, Math.min(item.quantity || 1, liveProd.stock));
          await dispatch(addCartItem({ productId: pid, quantity: targetQty })).unwrap();
          addedCount++;
        } catch {
          unavailableCount++;
        }
      }

      if (addedCount > 0) {
        toast.show(
          `Added ${addedCount} item(s) from Order #${order._id.slice(-6).toUpperCase()} to your cart.${unavailableCount > 0 ? ` (${unavailableCount} unavailable skipped)` : ''}`,
          'success',
          'Cart Updated'
        );
        navigation.navigate('Cart');
      } else {
        toast.show('All items from this order are currently out of stock or unavailable.', 'error', 'Reorder Unavailable');
      }
    } catch {
      toast.show('Failed to reorder items. Please try again.', 'error');
    } finally {
      setReorderingId(null);
    }
  };

  const header = (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <Text style={styles.headerSubtitle}>AP Enterprises B2B Wholesale Supply</Text>
      </View>
    </View>
  );

  const isAdminOrSeller = user?.role === 'admin' || user?.role === 'seller';
  const showSkeleton = isInitialLoading || (loading && items.length === 0);
  const activeError = fetchError || error;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {header}

      {!user ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="lock-outline"
            title="Sign In Required"
            description="Please sign in or create an account to view and track your wholesale orders and invoices."
            actionLabel="Sign In"
            onAction={() => navigation.navigate('Login')}
          />
        </View>
      ) : showSkeleton ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(28, insets.bottom + 20) }]}
        >
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </ScrollView>
      ) : activeError && !items.length ? (
        <ErrorView
          message={activeError}
          onRetry={() => loadOrders(false)}
        />
      ) : !items.length ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="package-variant-closed"
            title="No Orders Found"
            description={
              isAdminOrSeller
                ? 'No commercial orders have been placed in the system yet.'
                : 'You have not placed any wholesale orders yet. Explore our beverages and farm eggs catalog.'
            }
            actionLabel="Browse Products"
            onAction={() => navigation.navigate('Home')}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={8}
          initialNumToRender={6}
          windowSize={7}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || loading}
              onRefresh={() => loadOrders(true)}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(28, insets.bottom + 20) }]}
          renderItem={({ item }) => {
            const tone = statusTone(item.status);
            const isExpanded = Boolean(expandedOrders[item._id]);
            const isCancelled = item.status === 'cancelled';
            const actionConfig = !isCancelled ? statusActionConfig[item.status] : undefined;
            const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            const activeItems = (item.items || []).filter((i) => i.status !== 'cancelled');
            const cancelledItems = (item.items || []).filter((i) => i.status === 'cancelled');
            const totalUnits = activeItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

            // 1. Original items total = sum of all items (active + cancelled)
            const originalItemsTotal = (item.items || []).reduce(
              (sum, i) => sum + (i.lineTotal !== undefined ? Number(i.lineTotal) : Number(i.unitPrice * i.quantity) || 0),
              0
            );

            // 2. Order adjustment = sum of only cancelled items
            const totalCancelledAmount = cancelledItems.reduce(
              (sum, i) => sum + (i.lineTotal !== undefined ? Number(i.lineTotal) : Number(i.unitPrice * i.quantity) || 0),
              0
            );

            // 3. Active items subtotal = sum of only non-cancelled items
            const activeSubtotal = activeItems.reduce(
              (sum, i) => sum + (i.lineTotal !== undefined ? Number(i.lineTotal) : Number(i.unitPrice * i.quantity) || 0),
              0
            );

            const deliveryFee = Number(item.deliveryFee) || 0;
            const discount = Number(item.discount) || 0;

            // 4. Final dynamic order total based strictly on active items
            const finalOrderTotal = Math.max(0, activeSubtotal + deliveryFee - discount);
            const amountPaid = Number(item.amountPaid) || 0;
            const amountDue = Math.max(0, finalOrderTotal - amountPaid);
            const paymentStatus = item.paymentStatus || (amountPaid >= finalOrderTotal ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'DUE');
            const payTone = paymentStatusTone(paymentStatus);

            const addr = item.deliveryAddress || item.deliveryAddressDetails || {};
            const contactName = addr.contactName || item.customerName || (typeof item.buyer === 'object' && item.buyer?.name) || 'Wholesale Buyer';
            const contactPhone = addr.phone || item.phoneNumber || (typeof item.buyer === 'object' && item.buyer?.phone) || '';
            const buyerCompany = (typeof item.buyer === 'object' && item.buyer?.companyName) || '';
            const addrLine1 = addr.addressLine1 || addr.street || item.shippingAddress || '';
            const addrLine2 = addr.addressLine2 || '';
            const addrCity = addr.city || '';
            const addrState = addr.state || '';
            const addrPincode = addr.pincode || addr.postalCode || '';

            return (
              <View style={[styles.card, isCancelled && styles.cardCancelled]}>
                {/* ORDER HEADER */}
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.orderIdRow}>
                      <Text style={styles.orderId}>Order #{item._id.slice(-6).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.orderDate}>Placed on {date}</Text>
                    {isAdminOrSeller && (
                      <Text style={styles.buyerCompanyText} numberOfLines={1}>
                        {contactName}{buyerCompany ? ` • ${buyerCompany}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.headerBadgesCol}>
                    <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <Text style={[styles.statusText, { color: tone.text }]}>
                        {statusLabel[item.status] || item.status}
                      </Text>
                    </View>
                    <View style={[styles.payBadge, { backgroundColor: payTone.bg, borderColor: payTone.border }]}>
                      <Text style={[styles.payBadgeText, { color: payTone.text }]}>{payTone.label}</Text>
                    </View>
                  </View>
                </View>

                {/* ORDER TOTAL & BRIEF SUMMARY BAR */}
                <View style={styles.orderStats}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.amount}>{formatINR(finalOrderTotal)}</Text>
                      {totalCancelledAmount > 0 ? (
                        <View style={styles.revisedBadgePill}>
                          <Text style={styles.revisedBadgeText}>REVISED TOTAL</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.meta}>
                      {activeItems.length} active item{activeItems.length === 1 ? '' : 's'} • {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                      {cancelledItems.length > 0 ? ` (${cancelledItems.length} cancelled)` : ''}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.expandToggleBtn}
                    onPress={() => toggleExpand(item._id)}
                  >
                    <Text style={styles.expandToggleText}>
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                {/* ORDER-LEVEL CANCELLATION BANNER */}
                {isCancelled ? (
                  <View style={styles.orderCancelledBanner}>
                    <View style={styles.orderCancelledBannerHeader}>
                      <MaterialCommunityIcons name="alert-circle" size={18} color={colors.danger} />
                      <Text style={styles.orderCancelledTitle}>Order Cancelled by Admin</Text>
                    </View>
                    {item.cancellationReason ? (
                      <Text style={styles.orderCancelledReasonText}>
                        Cancellation Note:{' '}
                        <Text style={styles.orderCancelledReasonHighlight}>
                          "{item.cancellationReason}"
                        </Text>
                      </Text>
                    ) : null}
                    {item.cancelledAt ? (
                      <Text style={styles.orderCancelledDateText}>
                        Cancelled on {new Date(item.cancelledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  /* TIMELINE PROGRESS */
                  <OrderStatusTimeline status={item.status as any} />
                )}

                {/* EXPANDABLE ORDER DETAILS SECTION */}
                {isExpanded ? (
                  <View style={styles.expandedSection}>
                    <View style={styles.divider} />

                    {/* 1. ORDERED PRODUCT ITEMS */}
                    <View style={styles.sectionHeaderRow}>
                      <MaterialCommunityIcons name="package-variant-closed" size={16} color={colors.primary} />
                      <Text style={styles.detailsSectionTitle}>Ordered Products</Text>
                    </View>

                    <View style={styles.itemsList}>
                      {(item.items || []).map((orderItem, idx) => {
                        const imgUrl = getItemImageUrl(orderItem);
                        const cat = getItemCategory(orderItem);
                        const unitName = getItemUnit(orderItem);
                        const isEgg = cat.toLowerCase().includes('egg');
                        const isItemCancelled = orderItem.status === 'cancelled';
                        const itemCost = orderItem.lineTotal !== undefined ? orderItem.lineTotal : orderItem.subtotal !== undefined ? orderItem.subtotal : orderItem.unitPrice * orderItem.quantity;

                        return (
                          <View key={`item-${idx}`} style={[styles.itemRow, isItemCancelled && styles.itemRowCancelled]}>
                            {/* Product Thumbnail */}
                            <View style={styles.itemThumbWrap}>
                              {imgUrl ? (
                                <Image source={{ uri: imgUrl }} style={styles.itemThumb} resizeMode="cover" />
                              ) : (
                                <MaterialCommunityIcons
                                  name={isEgg ? 'egg-outline' : 'bottle-soda-classic-outline'}
                                  size={22}
                                  color={colors.primary}
                                />
                              )}
                            </View>

                            {/* Item Details */}
                            <View style={styles.itemInfo}>
                              <View style={styles.itemNameRow}>
                                <Text style={[styles.itemName, isItemCancelled && styles.itemNameCancelled]} numberOfLines={1}>
                                  {orderItem.name}
                                </Text>
                                {isItemCancelled ? (
                                  <View style={styles.itemCancelledBadge}>
                                    <Text style={styles.itemCancelledBadgeText}>CANCELLED</Text>
                                  </View>
                                ) : null}
                              </View>

                              <Text style={styles.itemCategory}>
                                {cat} {orderItem.packSize ? `• ${orderItem.packSize}` : ''}
                              </Text>

                              <Text style={styles.itemQtyPrice}>
                                {orderItem.quantity} {unitName}{orderItem.quantity > 1 ? 's' : ''} × {formatINR(orderItem.unitPrice)}
                              </Text>

                              {/* Item cancellation reason note */}
                              {isItemCancelled && orderItem.cancellationReason ? (
                                <View style={styles.itemCancellationNoteBox}>
                                  <Ionicons name="information-circle-outline" size={13} color={colors.danger} />
                                  <Text style={styles.itemCancellationNoteText}>
                                    Note: "{orderItem.cancellationReason}"
                                  </Text>
                                </View>
                              ) : null}

                              {/* Admin Cancel Item button */}
                              {user?.role === 'admin' && !isCancelled && item.status !== 'delivered' && !isItemCancelled && (
                                <TouchableOpacity
                                  style={styles.cancelItemBtn}
                                  onPress={() => openCancelItemModal(item, orderItem, idx)}
                                  hitSlop={6}
                                >
                                  <MaterialCommunityIcons name="close-circle-outline" size={13} color={colors.danger} />
                                  <Text style={styles.cancelItemBtnText}>Cancel Product</Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Line Total & Cancellation Strike */}
                            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                              <Text style={[styles.itemSubtotal, isItemCancelled && styles.itemSubtotalCancelled]}>
                                {formatINR(itemCost)}
                              </Text>
                              {isItemCancelled ? (
                                <Text style={styles.itemCancelledAdjustmentTag}>
                                  -{formatINR(itemCost)}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* 2. DELIVERY ADDRESS */}
                    <View style={styles.addressBlock}>
                      <View style={styles.addressTitleRow}>
                        <Ionicons name="location-outline" size={16} color={colors.primary} />
                        <Text style={styles.addressTitle}>Delivery Location</Text>
                      </View>

                      <View style={styles.addressFieldRow}>
                        <Text style={styles.addressFieldLabel}>Customer Name:</Text>
                        <Text style={styles.addressFieldValue}>{contactName}</Text>
                      </View>

                      {contactPhone ? (
                        <View style={styles.addressFieldRow}>
                          <Text style={styles.addressFieldLabel}>Phone Number:</Text>
                          <Text style={styles.addressFieldValue}>{contactPhone}</Text>
                        </View>
                      ) : null}

                      <View style={styles.addressFieldRow}>
                        <Text style={styles.addressFieldLabel}>Address Line 1:</Text>
                        <Text style={styles.addressFieldValue}>{addrLine1 || 'N/A'}</Text>
                      </View>

                      {addrLine2 ? (
                        <View style={styles.addressFieldRow}>
                          <Text style={styles.addressFieldLabel}>Address Line 2:</Text>
                          <Text style={styles.addressFieldValue}>{addrLine2}</Text>
                        </View>
                      ) : null}

                      <View style={styles.addressFieldRow}>
                        <Text style={styles.addressFieldLabel}>City:</Text>
                        <Text style={styles.addressFieldValue}>{addrCity || 'N/A'}</Text>
                      </View>

                      <View style={styles.addressFieldRow}>
                        <Text style={styles.addressFieldLabel}>State:</Text>
                        <Text style={styles.addressFieldValue}>{addrState || 'N/A'}</Text>
                      </View>

                      <View style={styles.addressFieldRow}>
                        <Text style={styles.addressFieldLabel}>Pincode:</Text>
                        <Text style={styles.addressFieldValue}>{addrPincode || 'N/A'}</Text>
                      </View>

                      {item.notes ? (
                        <View style={styles.notesBox}>
                          <Ionicons name="document-text-outline" size={13} color="#92400E" />
                          <Text style={styles.addressNotes}>Note: {item.notes}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* 3. DELIVERY INFORMATION & REAL TIME ETA */}
                    {!isCancelled && (
                      <View style={styles.etaCard}>
                        <View style={styles.etaHeaderRow}>
                          <MaterialCommunityIcons name="truck-delivery-outline" size={17} color={colors.primary} />
                          <Text style={styles.etaHeaderTitle}>Delivery Status & ETA</Text>
                        </View>

                        {item.status === 'delivered' ? (
                          <View style={styles.etaStatusBox}>
                            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                            <Text style={styles.etaStatusSuccessText}>
                              Delivered on {item.deliveredAt ? new Date(item.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : date}
                            </Text>
                          </View>
                        ) : item.estimatedDeliveryDate ? (
                          <View style={styles.etaStatusBox}>
                            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                            <Text style={styles.etaStatusText}>
                              Expected Delivery: {new Date(item.estimatedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {item.estimatedDeliverySlot ? ` (${item.estimatedDeliverySlot})` : ''}
                            </Text>
                          </View>
                        ) : item.status === 'shipped' ? (
                          <View style={styles.etaStatusBox}>
                            <Ionicons name="paper-plane-outline" size={15} color={colors.primary} />
                            <Text style={styles.etaStatusText}>Dispatched for delivery • Expected within 24–48 hrs</Text>
                          </View>
                        ) : (
                          <View style={styles.etaStatusBox}>
                            <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
                            <Text style={styles.etaStatusMutedText}>Delivery estimate will be available after dispatch.</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* 4. FINANCIAL PAYMENT BREAKDOWN */}
                    <View style={styles.priceBreakdown}>
                      {totalCancelledAmount > 0 ? (
                        <>
                          <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Original Items Subtotal</Text>
                            <Text style={[styles.priceVal, { textDecorationLine: 'line-through', color: colors.textMuted }]}>
                              {formatINR(originalItemsTotal)}
                            </Text>
                          </View>
                          <View style={styles.priceRow}>
                            <Text style={[styles.priceLabel, { color: '#DC2626', fontWeight: '700' }]}>
                              Order Adjustment
                            </Text>
                            <Text style={[styles.priceVal, { color: '#DC2626', fontWeight: '800' }]}>
                              -{formatINR(totalCancelledAmount)}
                            </Text>
                          </View>
                          <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Active Items Subtotal</Text>
                            <Text style={styles.priceVal}>{formatINR(activeSubtotal)}</Text>
                          </View>
                        </>
                      ) : (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Items Subtotal</Text>
                          <Text style={styles.priceVal}>{formatINR(activeSubtotal)}</Text>
                        </View>
                      )}

                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Delivery Charges</Text>
                        <Text style={[styles.priceVal, deliveryFee === 0 && styles.freeDeliveryText]}>
                          {deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee)}
                        </Text>
                      </View>

                      {discount > 0 ? (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Wholesale Discount</Text>
                          <Text style={styles.discountVal}>-{formatINR(discount)}</Text>
                        </View>
                      ) : null}

                      <View style={styles.breakdownDivider} />

                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Amount Paid</Text>
                        <Text style={[styles.priceVal, { color: '#16A34A', fontWeight: '800' }]}>{formatINR(amountPaid)}</Text>
                      </View>

                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Amount Due</Text>
                        <Text style={[styles.priceVal, { color: amountDue > 0 ? '#DC2626' : '#16A34A', fontWeight: '800' }]}>
                          {formatINR(amountDue)}
                        </Text>
                      </View>

                      <View style={[styles.priceRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total Order Amount</Text>
                        <Text style={styles.totalVal}>{formatINR(finalOrderTotal)}</Text>
                      </View>

                      <View style={styles.paymentStatusRow}>
                        <Text style={styles.priceLabel}>Payment Status</Text>
                        <View style={[styles.payBadge, { backgroundColor: payTone.bg, borderColor: payTone.border }]}>
                          <Text style={[styles.payBadgeText, { color: payTone.text }]}>{payTone.label}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* ACTIONS */}
                <View style={styles.actionsColumn}>
                  {/* ADMIN STATUS ADVANCE BUTTON */}
                  {isAdminOrSeller && actionConfig ? (
                    <AppButton
                      title={actionConfig.label}
                      icon={actionConfig.icon}
                      variant={actionConfig.variant}
                      fullWidth
                      loading={updatingId === item._id}
                      onPress={() => handleUpdateStatus(item._id, actionConfig.nextStatus)}
                    />
                  ) : null}

                  {/* ADMIN MARK AS PAID BUTTON */}
                  {isAdminOrSeller && amountDue > 0 && !isCancelled && (
                    <Pressable
                      style={styles.markPaidButton}
                      disabled={updatingId === item._id}
                      onPress={() => handleMarkPaid(item)}
                    >
                      <MaterialCommunityIcons name="credit-card-check-outline" size={17} color={colors.primary} />
                      <Text style={styles.markPaidText}>Mark Full Payment as Paid ({formatINR(amountDue)})</Text>
                    </Pressable>
                  )}

                  {/* ADMIN CANCEL ORDER BUTTON (FEATURE 5) */}
                  {user?.role === 'admin' && !isCancelled && item.status !== 'delivered' && (
                    <TouchableOpacity
                      style={styles.adminCancelOrderBtn}
                      onPress={() => openCancelOrderModal(item)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.danger} />
                      <Text style={styles.adminCancelOrderBtnText}>Cancel Wholesale Order</Text>
                    </TouchableOpacity>
                  )}

                  {/* BUYER REORDER ENTIRE ORDER BUTTON */}
                  {!isAdminOrSeller && !isCancelled && (
                    <AppButton
                      title="Reorder Entire Order"
                      icon="refresh"
                      variant="secondary"
                      fullWidth
                      loading={reorderingId === item._id}
                      onPress={() => handleReorderEntireOrder(item)}
                    />
                  )}

                  {/* ORDER CHAT & SUPPORT BUTTON */}
                  <Pressable
                    onPress={() => navigation.navigate('Chat', { orderId: item._id })}
                    style={styles.detailsButton}
                  >
                    <MaterialCommunityIcons name="chat-processing-outline" size={18} color={colors.primary} />
                    <Text style={styles.detailsText}>Order Chat & Support</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ADMIN CANCEL ORDER MODAL (FEATURE 5) */}
      <Modal
        visible={cancelOrderModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isCancellingOrder) setCancelOrderModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialCommunityIcons name="alert-octagon-outline" size={22} color={colors.danger} />
                <View>
                  <Text style={styles.modalTitle}>Cancel Wholesale Order</Text>
                  <Text style={styles.modalSub}>
                    Order #{cancellingOrder?._id?.slice(-6)?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setCancelOrderModalVisible(false)}
                disabled={isCancellingOrder}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalWarningText}>
              Cancelling this order will restore reserved product stock back to inventory and immediately notify the customer with your cancellation reason note.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reason for Cancellation *</Text>
              <TextInput
                style={styles.formInputMultiline}
                placeholder="e.g. Out of stock at distributor warehouse / customer requested / logistical bottleneck"
                placeholderTextColor={colors.textMuted}
                value={cancelOrderReason}
                onChangeText={setCancelOrderReason}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCancelOrderModalVisible(false)}
                disabled={isCancellingOrder}
              >
                <Text style={styles.modalCancelBtnText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalDestructiveBtn, isCancellingOrder && { opacity: 0.6 }]}
                onPress={handleConfirmCancelOrder}
                disabled={isCancellingOrder}
              >
                {isCancellingOrder ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="close-circle" size={16} color={colors.white} />
                    <Text style={styles.modalDestructiveBtnText}>Confirm Cancellation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ADMIN CANCEL ITEM MODAL (FEATURE 6) */}
      <Modal
        visible={cancelItemModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isCancellingItem) setCancelItemModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialCommunityIcons name="package-variant-minus" size={22} color={colors.danger} />
                <View>
                  <Text style={styles.modalTitle}>Cancel Product from Order</Text>
                  <Text style={styles.modalSub}>{cancellingItem?.name}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setCancelItemModalVisible(false)}
                disabled={isCancellingItem}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalWarningText}>
              This item will be marked as cancelled in the customer's order. Stock for {cancellingItem?.quantity} unit(s) will be automatically restored to the catalog.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Item Cancellation Note for Customer *</Text>
              <TextInput
                style={styles.formInputMultiline}
                placeholder="e.g. This specific brand/variant is currently out of stock. Remaining order items will be dispatched."
                placeholderTextColor={colors.textMuted}
                value={cancelItemReason}
                onChangeText={setCancelItemReason}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCancelItemModalVisible(false)}
                disabled={isCancellingItem}
              >
                <Text style={styles.modalCancelBtnText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalDestructiveBtn, isCancellingItem && { opacity: 0.6 }]}
                onPress={handleConfirmCancelItem}
                disabled={isCancellingItem}
              >
                {isCancellingItem ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="close-circle" size={16} color={colors.white} />
                    <Text style={styles.modalDestructiveBtnText}>Cancel Item</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: 1
  },
  list: {
    padding: 16,
    gap: 14
  },
  emptyWrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center'
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadows.card
  },
  cardCancelled: {
    borderColor: '#FECACA',
    backgroundColor: colors.card
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  headerBadgesCol: {
    alignItems: 'flex-end',
    gap: 4
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  orderId: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  orderDate: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2
  },
  buyerCompanyText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  payBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  payBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  orderStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  amount: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900'
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: 1,
    fontWeight: '600'
  },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.infoSurface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  expandToggleText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800'
  },
  orderCancelledBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 5
  },
  orderCancelledBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  orderCancelledTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger
  },
  orderCancelledReasonText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 17
  },
  orderCancelledReasonHighlight: {
    fontWeight: '700',
    color: '#991B1B'
  },
  orderCancelledDateText: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 2
  },
  expandedSection: {
    gap: 12
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  detailsSectionTitle: {
    color: colors.navy,
    fontSize: 13.5,
    fontWeight: '900'
  },
  itemsList: {
    gap: 8
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10
  },
  itemRowCancelled: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FECACA'
  },
  itemThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border
  },
  itemThumb: {
    width: '100%',
    height: '100%'
  },
  itemInfo: {
    flex: 1,
    gap: 2
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  itemName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  itemNameCancelled: {
    color: colors.textMuted,
    textDecorationLine: 'line-through'
  },
  itemCancelledBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  itemCancelledBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.danger
  },
  itemCategory: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600'
  },
  itemQtyPrice: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700'
  },
  itemCancellationNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.xs,
    marginTop: 3
  },
  itemCancellationNoteText: {
    fontSize: 10.5,
    color: colors.danger,
    fontWeight: '600',
    flex: 1
  },
  cancelItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  cancelItemBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.danger
  },
  itemSubtotal: {
    color: colors.navy,
    fontSize: 13.5,
    fontWeight: '900'
  },
  itemSubtotalCancelled: {
    color: colors.textMuted,
    textDecorationLine: 'line-through'
  },
  itemCancelledAdjustmentTag: {
    color: '#DC2626',
    fontSize: 10.5,
    fontWeight: '800',
    marginTop: 2
  },
  revisedBadgePill: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.xs
  },
  revisedBadgeText: {
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  addressBlock: {
    backgroundColor: colors.cardAlt,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4
  },
  addressTitle: {
    color: colors.navy,
    fontSize: 12.5,
    fontWeight: '800'
  },
  addressFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 1.5
  },
  addressFieldLabel: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '700',
    width: 104
  },
  addressFieldValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    padding: 6,
    borderRadius: radius.sm,
    marginTop: 4
  },
  addressNotes: {
    color: '#92400E',
    fontSize: 11.5,
    fontWeight: '700'
  },
  etaCard: {
    backgroundColor: colors.cardAlt,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8
  },
  etaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  etaHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.navy
  },
  etaStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  etaStatusSuccessText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success
  },
  etaStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  etaStatusMutedText: {
    fontSize: 11.5,
    color: colors.textSecondary
  },
  priceBreakdown: {
    backgroundColor: colors.cardAlt,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  priceLabel: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600'
  },
  priceVal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  freeDeliveryText: {
    color: colors.success,
    fontWeight: '800'
  },
  discountVal: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800'
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2
  },
  totalRow: {
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  totalLabel: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '900'
  },
  totalVal: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900'
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  actionsColumn: {
    gap: 8,
    marginTop: 4
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  markPaidText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '800'
  },
  adminCancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  adminCancelOrderBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800'
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  detailsText: {
    flex: 1,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 8
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    gap: 14,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.navy
  },
  modalSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalWarningText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    backgroundColor: colors.cardAlt,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  formGroup: {
    gap: 6
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.text
  },
  formInputMultiline: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 13.5,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 16
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelBtnText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '700'
  },
  modalDestructiveBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalDestructiveBtnText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '800'
  }
});
