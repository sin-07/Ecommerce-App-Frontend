import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { EmptyState, ErrorView, LoadingView } from '../components/StateViews';
import { OrderStatusTimeline } from '../components/OrderStatusTimeline';
import { colors, radius, shadows } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { fetchAdminOrders, fetchBuyerOrders, fetchSellerOrders, updateOrderStatus } from '../redux/slices/orderSlice';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Orders'>;

const statusFlow = ['pending', 'packed', 'shipped', 'delivered'] as const;

const statusActionConfig: Record<
  string,
  { nextStatus: (typeof statusFlow)[number]; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; variant: 'primary' | 'success' }
> = {
  pending: { nextStatus: 'packed', label: 'Confirm Beverage Order', icon: 'check-circle-outline', variant: 'primary' },
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

export const OrdersScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { items, loading, error } = useAppSelector((state) => state.orders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'buyer') dispatch(fetchBuyerOrders());
    if (user?.role === 'seller') dispatch(fetchSellerOrders());
    if (user?.role === 'admin') dispatch(fetchAdminOrders());
  }, [dispatch, user?.role]);

  const handleUpdateStatus = async (orderId: string, nextStatus: (typeof statusFlow)[number]) => {
    setUpdatingId(orderId);
    try {
      await dispatch(updateOrderStatus({ id: orderId, status: nextStatus })).unwrap();
      toast.show(
        `Order #${orderId.slice(-6).toUpperCase()} updated to ${statusLabel[nextStatus]}. Customer notified by email.`,
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
        <Text style={styles.headerSubtitle}>AP Enterprises B2B Beverage Fulfillment</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        <LoadingView label="Loading beverage orders..." />
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
            icon="bottle-soda-classic-outline"
            title="No orders found"
            description="Your wholesale beverage orders will appear here once placed."
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
            const actionConfig = statusActionConfig[item.status];
            const tone = statusTone(item.status);
            const date = new Date(item.createdAt).toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
            const totalCases = item.items.reduce((sum, i) => sum + i.quantity, 0);

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

                {/* ORDER STATS BAR */}
                <View style={styles.orderStats}>
                  <View>
                    <Text style={styles.amount}>${item.totalAmount.toFixed(2)}</Text>
                    <Text style={styles.meta}>
                      {item.items.length} beverage line{item.items.length === 1 ? '' : 's'} • {totalCases} cases total
                    </Text>
                  </View>
                  <View style={styles.beverageBadge}>
                    <MaterialCommunityIcons name="bottle-soda-classic" size={20} color={colors.primary} />
                  </View>
                </View>

                {/* TIMELINE PROGRESS */}
                <OrderStatusTimeline status={item.status as any} />

                {/* RESPONSIVE FULL-WIDTH ACTIONS */}
                <View style={styles.actionsColumn}>
                  {/* ADMIN / SELLER CONTEXT-AWARE STATUS UPDATE BUTTON */}
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
    fontSize: 12,
    marginTop: 1
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 70
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14
  },
  intro: {
    paddingVertical: 4,
    marginBottom: 4
  },
  introTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900'
  },
  introText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 14,
    ...shadows.card
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  orderId: {
    color: colors.navy,
    fontSize: 16.5,
    fontWeight: '900'
  },
  orderDate: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '800'
  },
  orderStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 12
  },
  amount: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '900'
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  beverageBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  actionsColumn: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    paddingTop: 4
  },
  detailsButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 8
  },
  detailsText: {
    color: colors.primaryPressed,
    fontSize: 13.5,
    fontWeight: '800',
    flex: 1
  }
});
