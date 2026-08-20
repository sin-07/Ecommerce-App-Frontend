import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
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
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

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
      haptics.successNotification();
      toast.show(
        `Order #${orderId.slice(-6).toUpperCase()} marked as ${statusLabel[nextStatus]}. Customer notified.`,
        'success',
        'Status Updated'
      );
    } catch (err: any) {
      haptics.errorNotification();
      toast.show(err || 'Unable to update order status.', 'error', 'Update Failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkPaid = async (order: Order) => {
    setUpdatingId(order._id);
    haptics.mediumImpact();
    try {
      await dispatch(
        updateOrderStatus({
          id: order._id,
          status: order.status,
          amountPaid: order.totalAmount,
          paymentStatus: 'PAID'
        })
      ).unwrap();
      haptics.successNotification();
      toast.show(
        `Order #${order._id.slice(-6).toUpperCase()} payment marked as PAID.`,
        'success',
        'Payment Updated'
      );
    } catch (err: any) {
      haptics.errorNotification();
      toast.show(err || 'Unable to update payment status.', 'error', 'Update Failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReorderEntireOrder = async (order: Order) => {
    if (!order.items || order.items.length === 0) return;
    haptics.mediumImpact();
    setReorderingId(order._id);
    let addedCount = 0;
    let unavailableCount = 0;

    try {
      for (const item of order.items) {
        const pid = typeof item.product === 'object' && item.product ? item.product._id : String(item.product);
        if (!pid) continue;

        try {
          const res = await api.get(`/products/${pid}`);
          const liveProd: Product = res.data.data;

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
            const actionConfig = statusActionConfig[item.status];
            const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            const totalUnits = (item.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
            const subtotal = item.subtotal || (item.items || []).reduce((sum, i) => sum + (i.lineTotal || i.unitPrice * i.quantity), 0);
            const deliveryFee = item.deliveryFee || 0;
            const discount = item.discount || 0;

            const amountPaid = Number(item.amountPaid || 0);
            const amountDue = Number(item.amountDue !== undefined ? item.amountDue : Math.max(item.totalAmount - amountPaid, 0));
            const paymentStatus = item.paymentStatus || (amountPaid >= item.totalAmount ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'DUE');
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
              <View style={styles.card}>
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
                    <Text style={styles.amount}>{formatINR(item.totalAmount)}</Text>
                    <Text style={styles.meta}>
                      {(item.items || []).length} product line{(item.items || []).length === 1 ? '' : 's'} • {totalUnits} unit{totalUnits === 1 ? '' : 's'}
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

                {/* TIMELINE PROGRESS */}
                <OrderStatusTimeline status={item.status as any} />

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

                        return (
                          <View key={`item-${idx}`} style={styles.itemRow}>
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
                              <Text style={styles.itemName} numberOfLines={1}>
                                {orderItem.name}
                              </Text>
                              <Text style={styles.itemCategory}>
                                {cat} {orderItem.packSize ? `• ${orderItem.packSize}` : ''}
                              </Text>
                              <Text style={styles.itemQtyPrice}>
                                {orderItem.quantity} {unitName}{orderItem.quantity > 1 ? 's' : ''} × {formatINR(orderItem.unitPrice)}
                              </Text>
                            </View>

                            {/* Line Total */}
                            <Text style={styles.itemSubtotal}>
                              {formatINR(orderItem.lineTotal || orderItem.subtotal || orderItem.unitPrice * orderItem.quantity)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* 2. DELIVERY ADDRESS (SEPARATED FIELDS) */}
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

                    {/* 4. FINANCIAL PAYMENT BREAKDOWN (SEPARATED PAID AND DUE) */}
                    <View style={styles.priceBreakdown}>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Items Subtotal</Text>
                        <Text style={styles.priceVal}>{formatINR(subtotal)}</Text>
                      </View>

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
                        <Text style={styles.totalVal}>{formatINR(item.totalAmount)}</Text>
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
                  {isAdminOrSeller && amountDue > 0 && (
                    <Pressable
                      style={styles.markPaidButton}
                      disabled={updatingId === item._id}
                      onPress={() => handleMarkPaid(item)}
                    >
                      <MaterialCommunityIcons name="credit-card-check-outline" size={17} color={colors.primary} />
                      <Text style={styles.markPaidText}>Mark Full Payment as Paid ({formatINR(amountDue)})</Text>
                    </Pressable>
                  )}

                  {/* BUYER REORDER ENTIRE ORDER BUTTON */}
                  {!isAdminOrSeller && (
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
  itemName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
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
  itemSubtotal: {
    color: colors.navy,
    fontSize: 13.5,
    fontWeight: '900'
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
  addressRecipient: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  inlineInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  addressPhone: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  addressBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
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
  }
});
