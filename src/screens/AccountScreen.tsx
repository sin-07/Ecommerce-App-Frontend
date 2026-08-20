import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { EmptyState, ErrorView } from '../components/StateViews';
import { api } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { CustomerStats } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { logout } from '../redux/slices/authSlice';
import { RootStackParamList } from '../navigation/types';
import { formatINR } from '../utils/currency';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export const AccountScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { user } = useAppSelector((state) => state.auth);

  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await api.get('/orders/buyer/stats');
      setStats(res.data.data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [user, loadStats]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of AP Enterprises?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await dispatch(logout()).unwrap();
            toast.info('Signed out successfully');
            navigation.navigate('Home');
          } catch {
            toast.error('Failed to sign out');
          } finally {
            setLoggingOut(false);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account & Dashboard</Text>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {!user ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="account-lock-outline"
            title="Sign In Required"
            description="Please sign in or create an account to view your trade dashboard, order statistics, and saved supplies."
            actionLabel="Sign In"
            onAction={() => navigation.navigate('Login')}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(30, insets.bottom + 20) }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadStats(true)} colors={[colors.primary]} />
          }
        >
          {/* 1. CUSTOMER PROFILE CARD */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {user.name ? user.name.slice(0, 2).toUpperCase() : 'AP'}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.name}
                </Text>
                {user.isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.userEmail}>{user.email}</Text>
              {user.phone ? <Text style={styles.userPhone}>+91 {user.phone}</Text> : null}
              {user.companyName ? (
                <View style={styles.companyBadge}>
                  <MaterialCommunityIcons name="store-outline" size={13} color={colors.primary} />
                  <Text style={styles.companyText}>{user.companyName}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 2. REAL TRADE ORDER METRICS */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Business Order Activity</Text>
            <Text style={styles.sectionSubtitle}>Verified order metrics</Text>
          </View>

          {loading && !refreshing ? (
            <View style={styles.statsSkeletonGrid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.statSkeletonBox} />
              ))}
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {/* Total Orders */}
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} />
                </View>
                <Text style={styles.statNumber}>{stats?.totalOrders || 0}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>

              {/* In Transit */}
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#FFFBEB' }]}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={20} color="#D97706" />
                </View>
                <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats?.inTransitOrders || 0}</Text>
                <Text style={styles.statLabel}>Active / In-Transit</Text>
              </View>

              {/* Delivered */}
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialCommunityIcons name="check-decagram-outline" size={20} color={colors.success} />
                </View>
                <Text style={[styles.statNumber, { color: colors.success }]}>{stats?.completedOrders || 0}</Text>
                <Text style={styles.statLabel}>Delivered</Text>
              </View>

              {/* Total Spend */}
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#F5F3FF' }]}>
                  <MaterialCommunityIcons name="currency-inr" size={20} color="#7C3AED" />
                </View>
                <Text style={[styles.statNumber, { color: colors.navy }]}>
                  {formatINR(stats?.totalSpend || 0)}
                </Text>
                <Text style={styles.statLabel}>Total Procurement</Text>
              </View>
            </View>
          )}

          {/* 3. QUICK ACTIONS GRID */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => navigation.navigate('Orders')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.actionTileTitle}>My Orders</Text>
              <Text style={styles.actionTileDesc}>Track & reorder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => navigation.navigate('Cart')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="cart-outline" size={24} color={colors.success} />
              </View>
              <Text style={styles.actionTileTitle}>Wholesale Cart</Text>
              <Text style={styles.actionTileDesc}>Review items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => navigation.navigate('Wishlist')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="heart-outline" size={24} color={colors.danger} />
              </View>
              <Text style={styles.actionTileTitle}>Wishlist</Text>
              <Text style={styles.actionTileDesc}>Saved products</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => navigation.navigate('Catalog')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#FFFBEB' }]}>
                <MaterialCommunityIcons name="storefront-outline" size={24} color="#D97706" />
              </View>
              <Text style={styles.actionTileTitle}>Quick Order</Text>
              <Text style={styles.actionTileDesc}>Explore catalog</Text>
            </TouchableOpacity>
          </View>

          {/* 3.5 APPEARANCE / THEME PREFERENCE */}
          <View style={styles.appearanceCard}>
            <View style={styles.appearanceHeader}>
              <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
              <Text style={styles.appearanceTitle}>Theme & Appearance</Text>
            </View>
            <View style={styles.themeOptionsRow}>
              {(['system', 'light', 'dark'] as const).map((mode) => {
                const isSelected = themeMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.themeSelectBtn, isSelected && styles.themeSelectBtnActive]}
                    onPress={() => {
                      haptics.selection();
                      setThemeMode(mode);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={mode === 'system' ? 'phone-portrait-outline' : mode === 'light' ? 'sunny-outline' : 'moon-outline'}
                      size={18}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.themeSelectText, isSelected && styles.themeSelectTextActive]}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 4. ACCOUNT SETTINGS & SIGN OUT */}
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                haptics.lightImpact();
                navigation.navigate('Notifications');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                <Text style={styles.menuLabel}>Notification Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleSignOut}
              disabled={loggingOut}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
                <Text style={[styles.menuLabel, { color: colors.danger }]}>Sign Out</Text>
              </View>
              {loggingOut ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.danger} />
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.navy
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    padding: 16,
    gap: 14
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    ...shadows.card
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900'
  },
  profileInfo: {
    flex: 1,
    gap: 3
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  userName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.navy,
    flexShrink: 1
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success
  },
  userEmail: {
    fontSize: 12.5,
    color: colors.textSecondary
  },
  userPhone: {
    fontSize: 12,
    color: colors.textMuted
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2
  },
  companyText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary
  },
  sectionHeaderRow: {
    marginTop: 6
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.navy
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  statCard: {
    width: '48.3%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    ...shadows.card
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  statsSkeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  statSkeletonBox: {
    width: '48.3%',
    height: 100,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  actionTile: {
    width: '48.3%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    ...shadows.card
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  actionTileTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.navy
  },
  actionTileDesc: {
    fontSize: 11,
    color: colors.textMuted
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    overflow: 'hidden',
    ...shadows.card
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  appearanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    gap: 10,
    ...shadows.card
  },
  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  appearanceTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.navy
  },
  themeOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  themeSelectBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  themeSelectBtnActive: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary
  },
  themeSelectText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted
  },
  themeSelectTextActive: {
    color: colors.primary,
    fontWeight: '800'
  }
});
