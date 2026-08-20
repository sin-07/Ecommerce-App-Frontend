import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { toggleWishlist, clearWishlist, loadWishlist } from '../redux/slices/wishlistSlice';
import { addCartItem } from '../redux/slices/cartSlice';
import { Product } from '../constants/types';
import { API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { formatINR } from '../utils/currency';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Wishlist'>;

export const WishlistScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { colors, isDark } = useTheme();
  const { items } = useAppSelector((state) => state.wishlist);
  const pendingCartItems = useAppSelector((state) => state.cart?.pendingItems || {});
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(loadWishlist());
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const handleRemove = useCallback(
    (product: Product) => {
      haptics.lightImpact();
      dispatch(toggleWishlist(product));
      toast.info(`Removed ${product.name} from wishlist`);
    },
    [dispatch]
  );

  const handleAddToCart = useCallback(
    async (product: Product) => {
      if (product.stock <= 0) {
        haptics.errorNotification();
        toast.error('This product is currently out of stock.');
        return;
      }
      haptics.mediumImpact();
      const step = Math.max(1, product.minOrderQuantity || 1);
      try {
        await dispatch(addCartItem({ productId: product._id, quantity: step })).unwrap();
        toast.success(`Added ${step} ${product.unit || 'unit'}(s) to cart.`);
      } catch (err: any) {
        haptics.errorNotification();
        toast.error(err || 'Failed to add to cart');
      }
    },
    [dispatch]
  );

  const renderItem = useCallback(
    ({ item }: { item: Product }) => {
      const isOutOfStock = item.stock <= 0;
      const isLowStock = item.stock > 0 && item.stock <= 10;
      const isPending = Boolean(item._id && pendingCartItems[item._id]);

      const imageUri = item.imageUrl
        ? item.imageUrl.startsWith('http')
          ? item.imageUrl
          : `${API_BASE_URL.replace('/api', '')}${item.imageUrl}`
        : '';

      return (
        <View style={styles.card}>
          <Pressable
            style={styles.imageWrap}
            onPress={() => navigation.navigate('ProductDetails', { productId: item._id, product: item })}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imageFallback}>
                <MaterialCommunityIcons
                  name={item.category?.toLowerCase().includes('egg') ? 'egg-outline' : 'bottle-soda-classic-outline'}
                  size={32}
                  color={colors.primary}
                />
              </View>
            )}

            {/* LOW STOCK / OUT OF STOCK BADGE */}
            {isOutOfStock ? (
              <View style={[styles.stockBadge, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                <Text style={[styles.stockBadgeText, { color: '#DC2626' }]}>OUT OF STOCK</Text>
              </View>
            ) : isLowStock ? (
              <View style={[styles.stockBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                <Text style={[styles.stockBadgeText, { color: '#D97706' }]}>ONLY {item.stock} LEFT</Text>
              </View>
            ) : null}
          </Pressable>

          <View style={styles.details}>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryBadge}>{item.category || 'General'}</Text>
              {item.discount ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{item.discount}% OFF</Text>
                </View>
              ) : null}
            </View>

            <Text
              style={styles.name}
              numberOfLines={2}
              onPress={() => navigation.navigate('ProductDetails', { productId: item._id, product: item })}
            >
              {item.name}
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatINR(item.price)}</Text>
              {item.unit ? <Text style={styles.unit}>/{item.unit}</Text> : null}
              {item.minOrderQuantity && item.minOrderQuantity > 1 ? (
                <Text style={styles.moqText}>(MOQ: {item.minOrderQuantity})</Text>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.addToCartBtn, (isOutOfStock || isPending) && styles.addToCartBtnDisabled]}
                onPress={() => handleAddToCart(item)}
                disabled={isOutOfStock || isPending}
                activeOpacity={0.8}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="cart-outline" size={16} color={colors.white} />
                    <Text style={styles.addToCartText}>Add to Cart</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemove(item)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [navigation, handleAddToCart, handleRemove, pendingCartItems]
  );

  const { user } = useAppSelector((state) => state.auth);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>My Wishlist</Text>
          <Text style={styles.headerSubtitle}>
            {user ? `${items.length} saved product${items.length === 1 ? '' : 's'}` : 'AP Enterprises Wholesale'}
          </Text>
        </View>
        {user && items.length > 0 ? (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              dispatch(clearWishlist());
              toast.info('Wishlist cleared');
            }}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {!user ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="lock-closed-outline" size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Sign In Required</Text>
          <Text style={styles.emptySubtitle}>
            Please sign in or create an account to view and manage your saved wholesale products.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="login" size={18} color={colors.white} />
              <Text style={styles.browseBtnText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary }]}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.primary} />
              <Text style={[styles.browseBtnText, { color: colors.primary }]}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="heart-dislike-outline" size={48} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Save your favorite beverages, fresh eggs, and wholesale supplies by tapping the heart icon on any product.
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.85}
          >
            <Ionicons name="storefront-outline" size={18} color={colors.white} />
            <Text style={styles.browseBtnText}>Explore Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
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
    paddingVertical: 14,
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
    fontSize: 18,
    fontWeight: '900',
    color: colors.navy,
    textAlign: 'center'
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSurface
  },
  clearBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800'
  },
  listContent: {
    padding: 16,
    gap: 12
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadows.card
  },
  imageWrap: {
    width: 90,
    height: 90,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative'
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cardAlt
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stockBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  stockBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  details: {
    flex: 1,
    justifyContent: 'space-between'
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  discountBadge: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill
  },
  discountText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.success
  },
  packSize: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 18
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4
  },
  price: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.navy
  },
  unit: {
    fontSize: 11,
    color: colors.textMuted
  },
  moqText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8
  },
  addToCartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: radius.sm
  },
  addToCartBtnDisabled: {
    opacity: 0.5
  },
  addToCartText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800'
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.navy,
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.pill,
    ...shadows.card
  },
  browseBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800'
  }
});
