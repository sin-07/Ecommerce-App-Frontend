import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminDashboardSkeleton } from '../components/AdminDashboardSkeleton';
import { AppButton } from '../components/AppButton';
import { BeverageLoader } from '../components/BeverageLoader';
import { DeveloperNoteModal } from '../components/DeveloperNoteModal';
import { EmptyState, ErrorView } from '../components/StateViews';
import { api } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { Order } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { logout } from '../redux/slices/authSlice';
import { formatINR } from '../utils/currency';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Dashboard = {
  users: number;
  totalProducts: number;
  activeProducts: number;
  lowStock: number;
  outOfStock: number;
  featuredProducts: number;
  totalOrders: number;
  revenue: number;
};

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.78);

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAppSelector((state) => state.auth);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [developerNoteVisible, setDeveloperNoteVisible] = useState(false);

  const statusTone = useCallback(
    (status: string) => {
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
    },
    [colors]
  );

  // Drawer state & animation
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Team Modal state
  const [teamModalVisible, setTeamModalVisible] = useState(false);

  const openDrawer = () => {
    haptics.lightImpact();
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 24,
        bounciness: 0
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true
      })
    ]).start(() => setDrawerOpen(false));
  };

  const isNavigatingRef = useRef(false);

  const navigateSafely = useCallback((screenName: any, params?: any) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    navigation.navigate(screenName, params);
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 400);
  }, [navigation]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setError('');
    try {
      const [dashboardRes, usersRes, ordersRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users'),
        api.get('/orders/admin').catch(() => ({ data: { data: [] } }))
      ]);

      setDashboard(dashboardRes.data.data);
      setUsers(usersRes.data.data || []);
      setRecentOrders((ordersRes.data?.data || []).slice(0, 4));
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'Unable to load admin dashboard.';
      if (!silent) {
        setError(message);
        toast.show(message, 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData(true);
    });
    return unsubscribe;
  }, [loadData, navigation]);

  // Android Back Button handler: closes drawer or open modals first
  useEffect(() => {
    const backAction = () => {
      if (drawerOpen) {
        closeDrawer();
        return true;
      }
      if (teamModalVisible) {
        setTeamModalVisible(false);
        return true;
      }
      if (developerNoteVisible) {
        setDeveloperNoteVisible(false);
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [drawerOpen, teamModalVisible, developerNoteVisible]);

  const toggleUserStatus = async (targetUser: AdminUser) => {
    try {
      await api.patch(`/admin/users/${targetUser._id}/status`, { isActive: !targetUser.isActive });
      toast.show(
        targetUser.isActive ? 'User account access paused.' : 'User account access restored.',
        'success'
      );
      await loadData(true);
    } catch (requestError: any) {
      toast.show(requestError?.response?.data?.message || 'Unable to update user status.', 'error');
    }
  };

  const pendingOrdersCount = recentOrders.filter(
    (o) => o.status === 'pending' || o.status === 'packed'
  ).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Open Admin Navigation Drawer"
          style={styles.drawerToggle}
          onPress={openDrawer}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="menu" size={24} color={colors.navy} />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>AP Enterprises</Text>
            <View style={styles.adminPill}>
              <Text style={styles.adminPillText}>ADMIN CONSOLE</Text>
            </View>
          </View>
          <Text style={styles.greeting} numberOfLines={1}>
            Hi, {user?.name?.split(' ')[0] || 'Administrator'}
          </Text>
        </View>

        <TouchableOpacity
          accessibilityLabel="Review Orders"
          style={styles.notifButton}
          onPress={() => navigateSafely('Orders')}
        >
          <MaterialCommunityIcons name="bell-outline" size={21} color={colors.navy} />
          {pendingOrdersCount > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      {/* BODY CONTENT */}
      {loading && !dashboard ? (
        <AdminDashboardSkeleton />
      ) : error && !dashboard ? (
        <View style={styles.errorWrap}>
          <ErrorView message={error} />
          <AppButton title="Retry" icon="refresh" variant="secondary" onPress={() => loadData(false)} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData(false);
              }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(30, insets.bottom + 24) }]}
        >
          {/* COMPACT 2X2 METRIC KPI CARDS */}
          <View style={styles.metricSection}>
            <Text style={styles.sectionHeading}>Wholesale Beverage Overview</Text>
            <View style={styles.metricGrid}>
              {/* TOTAL PRODUCTS */}
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: colors.infoSurface }]}>
                  <MaterialCommunityIcons name="bottle-soda-classic" size={20} color={colors.primary} />
                </View>
                <Text style={styles.kpiValue}>
                  {loading ? '—' : dashboard?.totalProducts || 0}
                </Text>
                <Text style={styles.kpiLabel}>Beverage SKUs</Text>
              </View>

              {/* ACTIVE LISTINGS */}
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: colors.successSurface }]}>
                  <MaterialCommunityIcons name="check-decagram-outline" size={20} color={colors.success} />
                </View>
                <Text style={styles.kpiValue}>
                  {loading ? '—' : dashboard?.activeProducts || 0}
                </Text>
                <Text style={styles.kpiLabel}>Active Listings</Text>
              </View>

              {/* TOTAL ORDERS */}
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: colors.warningSurface }]}>
                  <MaterialCommunityIcons name="clipboard-list-outline" size={20} color="#B45309" />
                </View>
                <Text style={styles.kpiValue}>
                  {loading ? '—' : dashboard?.totalOrders || 0}
                </Text>
                <Text style={styles.kpiLabel}>Total Orders</Text>
              </View>

              {/* REVENUE */}
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#E8EEF6' }]}>
                  <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.navy} />
                </View>
                <Text style={styles.kpiValue}>
                  {loading ? '—' : formatINR(dashboard?.revenue || 0, false)}
                </Text>
                <Text style={styles.kpiLabel}>Gross Revenue</Text>
              </View>
            </View>
          </View>

          {/* CONDITIONAL INVENTORY ALERTS (ONLY VISIBLE WHEN LOW STOCK > 0) */}
          {(dashboard?.lowStock || 0) > 0 || (dashboard?.outOfStock || 0) > 0 ? (
            <TouchableOpacity
              style={styles.alertCard}
              onPress={() => navigation.navigate('AdminProducts')}
              activeOpacity={0.88}
            >
              <View style={styles.alertIconWrap}>
                <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#92400E" />
              </View>
              <View style={styles.alertCopy}>
                <Text style={styles.alertTitle}>Inventory Alert</Text>
                <Text style={styles.alertText}>
                  {(dashboard?.lowStock || 0) > 0 && `${dashboard?.lowStock} beverages low on warehouse stock. `}
                  {(dashboard?.outOfStock || 0) > 0 && `${dashboard?.outOfStock} items out of stock.`}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#92400E" />
            </TouchableOpacity>
          ) : null}

          {/* QUICK ACTIONS BAR */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionHeading}>Quick Actions</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillPrimary]}
                onPress={() => navigateSafely('AddProduct')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="plus" size={17} color={colors.white} />
                <Text style={styles.actionPillPrimaryText}>Add Beverage</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => navigateSafely('AdminProducts')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="tune-variant" size={17} color={colors.primary} />
                <Text style={styles.actionPillText}>Catalog</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => navigateSafely('Orders')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="truck-delivery-outline" size={17} color={colors.primary} />
                <Text style={styles.actionPillText}>Orders</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* RECENT ORDERS FEED */}
          <View style={styles.recentOrdersSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Recent Wholesale Orders</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {!recentOrders.length ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No orders in queue</Text>
                <Text style={styles.emptySubtitle}>Customer beverage orders will appear here.</Text>
              </View>
            ) : (
              recentOrders.map((order) => {
                const tone = statusTone(order.status);
                const date = new Date(order.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                });
                const totalCases = order.items.reduce((s, i) => s + i.quantity, 0);

                return (
                  <TouchableOpacity
                    key={order._id}
                    style={styles.orderCard}
                    onPress={() => navigation.navigate('Orders')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.orderTopRow}>
                      <View>
                        <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
                        <Text style={styles.orderCustomer}>
                          {order.customerName || 'Wholesale Buyer'} • {date}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text style={[styles.statusBadgeText, { color: tone.text }]}>
                          {order.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.orderBottomRow}>
                      <Text style={styles.orderCases}>{totalCases} items ordered</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.orderAmount}>{formatINR(order.totalAmount)}</Text>
                        <Text style={styles.orderPaidDue}>
                          Paid: {formatINR(order.amountPaid || 0)} • Due: {formatINR(order.amountDue !== undefined ? order.amountDue : Math.max(order.totalAmount - (order.amountPaid || 0), 0))}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* TEAM / CUSTOMER COMPACT SUMMARY CARD */}
          <View style={styles.teamSummaryCard}>
            <View style={styles.teamSummaryLeft}>
              <View style={styles.teamIconWrap}>
                <MaterialCommunityIcons name="account-group-outline" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.teamSummaryTitle}>Registered Accounts</Text>
                <Text style={styles.teamSummarySubtitle}>
                  {users.length} buyer & staff account{users.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.manageTeamButton}
              onPress={() => setTeamModalVisible(true)}
            >
              <Text style={styles.manageTeamButtonText}>Manage</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* MODERN SLIDE-IN NAVIGATION DRAWER */}
      {drawerOpen && (
        <View style={styles.drawerContainer} pointerEvents="box-none">
          <Pressable style={styles.drawerBackdrop} onPress={closeDrawer}>
            <Animated.View style={[styles.backdropFill, { opacity: overlayAnim }]} />
          </Pressable>

          <Animated.View
            style={[
              styles.drawerPanel,
              {
                width: DRAWER_WIDTH,
                paddingTop: insets.top + 16,
                paddingBottom: insets.bottom + 20,
                transform: [{ translateX: drawerAnim }]
              }
            ]}
          >
            {/* DRAWER HEADER */}
            <View style={styles.drawerBrandSection}>
              <View style={styles.drawerLogoWrap}>
                <MaterialCommunityIcons name="bottle-soda-classic" size={26} color={colors.white} />
              </View>
              <View>
                <Text style={styles.drawerBrandName}>AP Enterprises</Text>
                <Text style={styles.drawerBrandRole}>Admin Console</Text>
              </View>
            </View>

            {/* DRAWER USER PROFILE */}
            <View style={styles.drawerUserCard}>
              <View style={styles.drawerAvatar}>
                <Text style={styles.drawerAvatarText}>
                  {(user?.name?.[0] || 'A').toUpperCase()}
                </Text>
              </View>
              <View style={styles.drawerUserInfo}>
                <Text style={styles.drawerUserName} numberOfLines={1}>
                  {user?.name || 'Administrator'}
                </Text>
                <Text style={styles.drawerUserEmail} numberOfLines={1}>
                  {user?.email}
                </Text>
              </View>
            </View>

            {/* DRAWER NAVIGATION ITEMS */}
            <ScrollView style={styles.drawerNavList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.drawerNavItem, styles.drawerNavItemActive]}
                onPress={closeDrawer}
              >
                <MaterialCommunityIcons name="view-dashboard-outline" size={20} color={colors.primary} />
                <Text style={[styles.drawerNavText, styles.drawerNavTextActive]}>Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  closeDrawer();
                  navigation.navigate('AdminProducts');
                }}
              >
                <MaterialCommunityIcons name="bottle-soda-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.drawerNavText}>Beverage Catalog</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  closeDrawer();
                  navigation.navigate('AddProduct');
                }}
              >
                <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.drawerNavText}>Add Beverage</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  closeDrawer();
                  navigation.navigate('Orders');
                }}
              >
                <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.drawerNavText}>Orders & Fulfillment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  closeDrawer();
                  setDeveloperNoteVisible(true);
                }}
              >
                <MaterialCommunityIcons name="code-tags" size={20} color={colors.textSecondary} />
                <Text style={styles.drawerNavText}>Developer Note</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* DRAWER LOGOUT */}
            <TouchableOpacity
              style={styles.drawerLogoutButton}
              onPress={() => {
                closeDrawer();
                dispatch(logout());
              }}
            >
              <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
              <Text style={styles.drawerLogoutText}>Sign Out</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      <DeveloperNoteModal
        visible={developerNoteVisible}
        onClose={() => setDeveloperNoteVisible(false)}
      />

      <BeverageLoader
        visible={signingOut}
        mode="auth"
        title="AP Enterprises"
        subtitle="Signing out of admin console..."
      />

      {/* TEAM & ACCOUNTS MANAGEMENT MODAL */}
      <Modal
        visible={teamModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTeamModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Registered Accounts</Text>
              <Text style={styles.modalSubtitle}>{users.length} accounts on AP Enterprises</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setTeamModalVisible(false)}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.navy} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {users.map((item) => (
              <View key={item._id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {item.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <View style={styles.userRoleBadge}>
                    <Text style={styles.userRoleText}>{item.role.toUpperCase()}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  disabled={item._id === user?.id}
                  onPress={() => toggleUserStatus(item)}
                  style={[
                    styles.userStatusButton,
                    item.isActive ? styles.userStatusActive : styles.userStatusPaused,
                    item._id === user?.id && styles.userStatusSelf
                  ]}
                >
                  <Text
                    style={[
                      styles.userStatusButtonText,
                      { color: item.isActive ? colors.success : colors.textSecondary }
                    ]}
                  >
                    {item._id === user?.id ? 'You' : item.isActive ? 'Active' : 'Paused'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12
  },
  drawerToggle: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm
  },
  headerCopy: {
    flex: 1
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  brandTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  adminPill: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  adminPillText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  greeting: {
    color: colors.navy,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 1
  },
  notifButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.sm
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.citrus
  },
  content: {
    paddingHorizontal: 16,
    gap: 18
  },
  errorWrap: {
    padding: 20,
    alignItems: 'center',
    gap: 12
  },
  metricSection: {
    gap: 10
  },
  sectionHeading: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '900'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800'
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  kpiCard: {
    width: '48.2%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
    ...shadows.card
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  kpiValue: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '900'
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    ...shadows.sm
  },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  alertCopy: {
    flex: 1
  },
  alertTitle: {
    color: '#78350F',
    fontSize: 13.5,
    fontWeight: '900'
  },
  alertText: {
    color: '#92400E',
    fontSize: 12,
    marginTop: 2
  },
  quickActionsSection: {
    gap: 10
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8
  },
  actionPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    ...shadows.sm
  },
  actionPillPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  actionPillPrimaryText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: '800'
  },
  actionPillText: {
    color: colors.navy,
    fontSize: 12.5,
    fontWeight: '800'
  },
  recentOrdersSection: {
    gap: 10
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 6
  },
  emptyTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800'
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 12
  },
  orderCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    ...shadows.card
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  orderId: {
    color: colors.navy,
    fontSize: 14.5,
    fontWeight: '900'
  },
  orderCustomer: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'capitalize'
  },
  orderBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8
  },
  orderCases: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  orderAmount: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '900'
  },
  orderPaidDue: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: 2
  },
  teamSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    ...shadows.card
  },
  teamSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  teamIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  teamSummaryTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800'
  },
  teamSummarySubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  manageTeamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.infoSurface
  },
  manageTeamButtonText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '800'
  },
  drawerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    flexDirection: 'row'
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  backdropFill: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)'
  },
  drawerPanel: {
    height: '100%',
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    gap: 14,
    ...shadows.modal
  },
  drawerBrandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  drawerLogoWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card
  },
  drawerBrandName: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '900'
  },
  drawerBrandRole: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  drawerUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 10
  },
  drawerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center'
  },
  drawerAvatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900'
  },
  drawerUserInfo: {
    flex: 1
  },
  drawerUserName: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '800'
  },
  drawerUserEmail: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1
  },
  drawerNavList: {
    flex: 1,
    marginTop: 6
  },
  drawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginBottom: 4
  },
  drawerNavItemActive: {
    backgroundColor: colors.infoSurface
  },
  drawerNavText: {
    color: colors.textSecondary,
    fontSize: 13.5,
    fontWeight: '700'
  },
  drawerNavTextActive: {
    color: colors.primary,
    fontWeight: '800'
  },
  drawerLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
    paddingHorizontal: 14
  },
  drawerLogoutText: {
    color: colors.danger,
    fontSize: 13.5,
    fontWeight: '800'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  modalTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '900'
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 2
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalContent: {
    padding: 16,
    gap: 10
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10,
    ...shadows.sm
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center'
  },
  userAvatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800'
  },
  userInfo: {
    flex: 1
  },
  userName: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800'
  },
  userEmail: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1
  },
  userRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 4
  },
  userRoleText: {
    color: colors.primary,
    fontSize: 9.5,
    fontWeight: '800'
  },
  userStatusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  userStatusActive: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder
  },
  userStatusPaused: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border
  },
  userStatusSelf: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder
  },
  userStatusButtonText: {
    fontSize: 11.5,
    fontWeight: '800'
  }
});
