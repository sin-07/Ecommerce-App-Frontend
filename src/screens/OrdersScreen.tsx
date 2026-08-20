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
  packed: { nextStatus: 'shipped', label: 'Dispatch Order (Notify Buyer)', icon: 'truck-fast-outline', variant: 'primary' },
  shipped: { nextStatus: 'delivered', label: 'Mark as Delivered', icon: 'check-decagram-outline', variant: 'success' }
};

const statusLabel: Record<string, string> = {
  pending: 'Processing',
  packed: 'Confirmed',
  shipped: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

const statusTone = (status: string) => {
  switch (status) {
    case 'delivered':
      return { bg: colors.successSurface, border: colors.successBorder, text: colors.success };
    case 'cancelled':
      return { bg: colors.dangerSurface, border: colors.dangerBorder, text: colors.danger };
    case 'shipped':
      return { bg: colors.infoSurface, border: colors.infoBorder, text: colors.primary };
    default:
      return { bg: colors.warningSurface, border: colors.warningBorder, text: '#92400E' };
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

  const header = (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <Text style={styles.headerSubtitle}>AP Enterprises B2B Fulfillment & Supply</Text>
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
        <ErrorView message={error} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {header}
      {!items.length ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="package-variant-closed"
            title="No Orders Placed Yet"
            description="Your wholesale beverage and egg orders will appear here once placed."
            actionLabel={user?.role === 'buyer' ? 'Browse Catalog' : 'Go Back'}
            onAction={() => (user?.role === 'buyer' ? navigation.navigate('Home') : navigation.goBack())}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Text style={styles.introTitle}>
                {user?.role === 'buyer' ? 'Your Wholesale Orders' : 'Fulfillment Queue'}
              </Text>
              <Text style={styles.introText}>
                {items.length} active and fulfilled order{items.length === 1 ? '' : 's'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isExpanded = Boolean(expandedOrders[item._id]);
            const actionConfig = statusActionConfig[item.status];
            const tone = statusTone(item.status);
            const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            const totalUnits = (item.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
            const subtotal = item.subtotal || (item.items || []).reduce((sum, i) => sum + (i.lineTotal || i.unitPrice * i.quantity), 0);
            const deliveryFee = item.deliveryFee || 0;
            const discount = item.discount || 0;

            const customerDisplayName =
              item.customerName ||
              item.deliveryAddressDetails?.fullName ||
              (typeof item.buyer === 'object' && item.buyer?.name) ||
              'Valued Wholesale Buyer';

            const customerPhone =
              item.phoneNumber ||
              item.deliveryAddressDetails?.phone ||
              (typeof item.buyer === 'object' && item.buyer?.phone) ||
              '';

            const formattedAddress =
              item.shippingAddress ||
              [
                item.deliveryAddressDetails?.street,
                item.deliveryAddressDetails?.city,
                item.deliveryAddressDetails?.state,
                item.deliveryAddressDetails?.postalCode,
                item.deliveryAddressDetails?.country
              ]
                .filter(Boolean)
                .join(', ');

            return (
              <View style={styles.card}>
                {/* ORDER HEADER */}
                <View style={styles.cardTop}>
                  <View>
                    <View style={styles.orderIdRow}>
                      <Text style={styles.orderId}>Order #{item._id.slice(-6).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.orderDate}>Placed on {date}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <Text style={[styles.statusText, { color: tone.text }]}>
                      {statusLabel[item.status] || item.status}
                    </Text>
                  </View>
                </View>

                {/* ORDER TOTAL & BRIEF SUMMARY BAR */}
                <View style={styles.orderStats}>
                  <View>
                    <Text style={styles.amount}>{formatINR(item.totalAmount)}</Text>
                    <Text style={styles.meta}>
                      {(item.items || []).length} product line{(item.items || []).length === 1 ? '' : 's'} • {totalUnits} total unit{totalUnits === 1 ? '' : 's'}
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
                    <Text style={styles.detailsSectionTitle}>📦 Ordered Products</Text>
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
                                {isEgg ? '🥚' : '🥤'} {cat} {orderItem.packSize ? `• ${orderItem.packSize}` : ''}
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
                        <Text style={styles.addressTitle}>Delivery Address</Text>
                      </View>

                      <Text style={styles.addressRecipient}>{customerDisplayName}</Text>
                      {customerPhone ? (
                        <Text style={styles.addressPhone}>📞 {customerPhone}</Text>
                      ) : null}
                      <Text style={styles.addressBody}>
                        {formattedAddress || 'Standard Warehouse / Store Address'}
                      </Text>
                      {item.notes ? (
                        <Text style={styles.addressNotes}>📝 Note: {item.notes}</Text>
                      ) : null}
                    </View>

                    {/* 3. FINANCIAL BREAKDOWN */}
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

                      <View style={[styles.priceRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total Paid / Due</Text>
                        <Text style={styles.totalVal}>{formatINR(item.totalAmount)}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* ACTIONS */}
                <View style={styles.actionsColumn}>
                  {/* ADMIN STATUS ADVANCE BUTTON */}
                  {(user?.role === 'seller' || user?.role === 'admin') && actionConfig ? (
                    <AppButton
                      title={actionConfig.label}
                      icon={actionConfig.icon}
                      variant={actionConfig.variant}
                      fullWidth
                      loading={updatingId === item._id}
                      onPress={() => handleUpdateStatus(item._id, actionConfig.nextStatus)}
                    />
                  ) : null}

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
  intro: {
    marginBottom: 6
  },
  introTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  introText: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 2
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  orderStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  amount: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900'
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2
  },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  expandToggleText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary
  },
  expandedSection: {
    gap: 12,
    paddingTop: 4
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4
  },
  detailsSectionTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  itemsList: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  itemThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
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
    fontSize: 11.5,
    fontWeight: '700'
  },
  itemSubtotal: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '900'
  },
  addressBlock: {
    backgroundColor: colors.infoSurface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    gap: 4
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2
  },
  addressTitle: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '900'
  },
  addressRecipient: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  addressPhone: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  addressBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17
  },
  addressNotes: {
    color: '#854D0E',
    fontSize: 11.5,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 2
  },
  priceBreakdown: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border
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
    fontWeight: '900'
  },
  discountVal: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800'
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    marginTop: 2
  },
  totalLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900'
  },
  totalVal: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900'
  },
  actionsColumn: {
    gap: 8,
    marginTop: 4
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  detailsText: {
    flex: 1,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 8
  }
});
