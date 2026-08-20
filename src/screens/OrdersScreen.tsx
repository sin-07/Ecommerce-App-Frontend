import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { EmptyState, ErrorView, LoadingView } from '../components/StateViews';
import { OrderStatusTimeline } from '../components/OrderStatusTimeline';
import { API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { Order, OrderItem } from '../constants/types';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { fetchAdminOrders, fetchBuyerOrders, fetchSellerOrders, updateOrderStatus } from '../redux/slices/orderSlice';
import { formatINR } from '../utils/currency';
import { toast } from '../utils/toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const { user } = useAppSelector((state) => state.auth);
  const { items, loading, error } = useAppSelector((state) => state.orders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user?.role === 'buyer') dispatch(fetchBuyerOrders());
    if (user?.role === 'seller') dispatch(fetchSellerOrders());
    if (user?.role === 'admin') dispatch(fetchAdminOrders());
  }, [dispatch, user?.role]);

  const toggleExpand = (orderId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: (typeof statusFlow)[number]) => {
    setUpdatingId(orderId);
    try {
      await dispatch(updateOrderStatus({ id: orderId, status: nextStatus })).unwrap();
      toast.show(
        `Order #${orderId.slice(-6).toUpperCase()} marked as ${statusLabel[nextStatus]}. Customer notified.`,
        'success',
        'Status Updated'
      );
    } catch (err: any) {
      toast.show(err || 'Unable to update order status.', 'error', 'Update Failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkPaid = async (order: Order) => {
    setUpdatingId(order._id);
    try {
      await dispatch(
        updateOrderStatus({
          id: order._id,
          status: order.status,
          amountPaid: order.totalAmount,
          paymentStatus: 'PAID'
        })
      ).unwrap();
      toast.show(
        `Order #${order._id.slice(-6).toUpperCase()} payment marked as PAID.`,
        'success',
        'Payment Updated'
      );
    } catch (err: any) {
      toast.show(err || 'Unable to update payment status.', 'error', 'Update Failed');
    } finally {
      setUpdatingId(null);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        <LoadingView label="Loading wholesale orders..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        <ErrorView
          message={error}
          onRetry={() => {
            if (user?.role === 'buyer') dispatch(fetchBuyerOrders());
            if (user?.role === 'seller') dispatch(fetchSellerOrders());
            if (user?.role === 'admin') dispatch(fetchAdminOrders());
          }}
        />
      </SafeAreaView>
    );
  }

  const isAdminOrSeller = user?.role === 'admin' || user?.role === 'seller';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {header}

      {!items.length ? (
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
          contentContainerStyle={styles.list}
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

                    {/* 2. DELIVERY ADDRESS */}
                    <View style={styles.addressBlock}>
                      <View style={styles.addressTitleRow}>
                        <Ionicons name="location-outline" size={16} color={colors.primary} />
                        <Text style={styles.addressTitle}>Delivery Location</Text>
                      </View>

                      <Text style={styles.addressRecipient}>{contactName}</Text>
                      {contactPhone ? (
                        <View style={styles.inlineInfoRow}>
                          <Ionicons name="call-outline" size={13} color={colors.textSecondary} />
                          <Text style={styles.addressPhone}>{contactPhone}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.addressBody}>{addrLine1}</Text>
                      {addrLine2 ? <Text style={styles.addressBody}>{addrLine2}</Text> : null}
                      <Text style={styles.addressBody}>
                        {[addrCity, addrState, addrPincode].filter(Boolean).join(', ')}
                      </Text>
                      {item.notes ? (
                        <View style={styles.notesBox}>
                          <Ionicons name="document-text-outline" size={13} color="#92400E" />
                          <Text style={styles.addressNotes}>Note: {item.notes}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* 3. FINANCIAL PAYMENT BREAKDOWN (SEPARATED PAID AND DUE) */}
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
    marginBottom: 2
  },
  addressTitle: {
    color: colors.navy,
    fontSize: 12.5,
    fontWeight: '800'
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
