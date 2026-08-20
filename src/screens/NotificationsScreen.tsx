import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorView } from '../components/StateViews';
import { api } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { AppNotification } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const getNotificationStyle = (type: string) => {
  switch (type) {
    case 'order':
      return { icon: 'truck-fast-outline' as const, bg: '#EFF6FF', color: colors.primary };
    case 'payment':
      return { icon: 'credit-card-outline' as const, bg: '#FFFBEB', color: '#D97706' };
    case 'delivery':
      return { icon: 'check-decagram-outline' as const, bg: '#ECFDF5', color: colors.success };
    case 'stock':
      return { icon: 'alert-circle-outline' as const, bg: '#FEF2F2', color: colors.danger };
    case 'reorder':
      return { icon: 'refresh' as const, bg: '#FAF5FF', color: '#9333EA' };
    default:
      return { icon: 'bell-outline' as const, bg: colors.cardAlt, color: colors.textSecondary };
  }
};

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAppSelector((state) => state.auth);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await api.get('/notifications');
      const data = res.data.data;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();
    } else {
      setLoading(false);
    }
  }, [user, loadNotifications]);

  const handleMarkAsRead = async (item: AppNotification) => {
    if (item.isRead) return;
    haptics.selection();
    try {
      await api.patch(`/notifications/${item._id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    haptics.lightImpact();
    setMarkingAll(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      haptics.successNotification();
      toast.success('All notifications marked as read');
    } catch {
      haptics.errorNotification();
      toast.error('Failed to update notifications');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationPress = async (item: AppNotification) => {
    haptics.lightImpact();
    await handleMarkAsRead(item);

    if (item.metadata?.orderId) {
      navigation.navigate('Orders');
    } else if (item.metadata?.productId) {
      navigation.navigate('ProductDetails', { productId: item.metadata.productId });
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const style = getNotificationStyle(item.type);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.notificationCard,
          !item.isRead && styles.unreadCard,
          pressed && styles.pressed
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconCircle, { backgroundColor: style.bg }]}>
          <MaterialCommunityIcons name={style.icon} size={20} color={style.color} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.title, !item.isRead && styles.unreadTitle]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.timestamp}>{formatTimeAgo(item.createdAt)}</Text>
          </View>

          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>

          {item.metadata?.orderId ? (
            <View style={styles.actionLinkRow}>
              <Text style={styles.actionLinkText}>View Order Details</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.primary} />
            </View>
          ) : item.metadata?.productId ? (
            <View style={styles.actionLinkRow}>
              <Text style={styles.actionLinkText}>View Product</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.primary} />
            </View>
          ) : null}
        </View>

        {!item.isRead ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <Text style={styles.headerSubtitle}>{unreadCount} unread update{unreadCount === 1 ? '' : 's'}</Text>
          ) : (
            <Text style={styles.headerSubtitle}>AP Enterprises B2B Updates</Text>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllAsRead}
            disabled={markingAll}
            hitSlop={8}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {!user ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="lock-outline"
            title="Sign In Required"
            description="Please sign in to view real-time delivery, order tracking, and payment alerts."
            actionLabel="Sign In"
            onAction={() => navigation.navigate('Login')}
          />
        </View>
      ) : loading && !refreshing ? (
        <View style={styles.skeletonWrap}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonIcon} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={styles.skeletonLine1} />
                <View style={styles.skeletonLine2} />
              </View>
            </View>
          ))}
        </View>
      ) : error && !notifications.length ? (
        <View style={styles.emptyWrap}>
          <ErrorView message={error} onRetry={() => loadNotifications(false)} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="bell-off-outline"
            title="No Notifications Yet"
            description="You will receive real-time notifications here when you place orders, make payments, or when shipments are dispatched."
            actionLabel="Browse Products"
            onAction={() => navigation.navigate('Home')}
          />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(28, insets.bottom + 16) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadNotifications(true)}
              colors={[colors.primary]}
            />
          }
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
  headerCenter: {
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.navy
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary
  },
  list: {
    padding: 16,
    gap: 10
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    position: 'relative',
    ...shadows.card
  },
  unreadCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BAE6FD'
  },
  pressed: {
    opacity: 0.85
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardContent: {
    flex: 1,
    gap: 4
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1
  },
  unreadTitle: {
    fontWeight: '900',
    color: colors.navy
  },
  timestamp: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600'
  },
  message: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 17
  },
  actionLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4
  },
  actionLinkText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    position: 'absolute',
    top: 14,
    right: 12
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  skeletonWrap: {
    padding: 16,
    gap: 12
  },
  skeletonCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0'
  },
  skeletonLine1: {
    width: '60%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  skeletonLine2: {
    width: '90%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#EEF2F6'
  }
});
