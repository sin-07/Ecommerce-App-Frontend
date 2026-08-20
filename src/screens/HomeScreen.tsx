import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const logoSource = require('../../assets/Ap-Enterprises.jpeg');
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ProductCardSkeleton';
import { BeverageLoader } from '../components/BeverageLoader';
import { DeveloperNoteModal } from '../components/DeveloperNoteModal';
import { EmptyState, ErrorView } from '../components/StateViews';
import { colors, radius, shadows } from '../constants/theme';
import { Product } from '../constants/types';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { logout } from '../redux/slices/authSlice';
import { addCartItem, fetchCart, removeCartItem, updateCartItem } from '../redux/slices/cartSlice';
import { clearProducts, fetchProducts } from '../redux/slices/productSlice';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Beverage categories for AP Enterprises
const BEVERAGE_CATEGORIES = [
  'Soft Drinks',
  'Juices',
  'Energy Drinks',
  'Water & Soda',
  'Tea & Coffee',
  'Dairy Beverages'
];

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { items, loading, loadingMore, error, page, totalPages } = useAppSelector((state) => state.products);
  const { user } = useAppSelector((state) => state.auth);
  const { items: cartItems } = useAppSelector((state) => state.cart);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [developerNoteVisible, setDeveloperNoteVisible] = useState(false);
  const cartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    dispatch(fetchProducts({ page: 1, limit: 12 }));
    dispatch(fetchCart());
  }, [dispatch]);

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (totalCartItems > 0) {
      Animated.sequence([
        Animated.timing(cartScale, { toValue: 1.22, duration: 120, useNativeDriver: true }),
        Animated.spring(cartScale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
      ]).start();
    }
  }, [totalCartItems, cartScale]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length === 0 || search.trim().length >= 2) {
        dispatch(fetchProducts({ page: 1, limit: 12, search: search.trim(), category }));
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [dispatch, search, category]);

  const requestProducts = useCallback(
    (nextCategory = category, nextSearch = search, nextPage = 1) => {
      dispatch(fetchProducts({ page: nextPage, limit: 12, search: nextSearch.trim(), category: nextCategory }));
    },
    [dispatch, category, search]
  );

  const loadNextPage = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    dispatch(fetchProducts({ page: page + 1, limit: 12, search: search.trim(), category }));
  }, [dispatch, loadingMore, page, totalPages, search, category]);

  const skeletonCards = useMemo(() => Array.from({ length: 6 }, (_, index) => index), []);

  const getCartQuantityForProduct = useCallback(
    (productId: string) => {
      const found = cartItems.find((item) => {
        const product = item.product as unknown as { _id?: string } | string;
        return (typeof product === 'string' ? product : product?._id) === productId;
      });
      return found?.quantity || 0;
    },
    [cartItems]
  );

  const incrementProduct = useCallback(
    async (productId: string, minOrderQuantity: number) => {
      const target = items.find((item) => item._id === productId);
      if (target && target.stock < 10) {
        toast.show('This beverage is currently out of stock.', 'error');
        return;
      }
      const current = getCartQuantityForProduct(productId);
      try {
        if (current <= 0) {
          const step = Math.max(1, minOrderQuantity || 1);
          await dispatch(addCartItem({ productId, quantity: step })).unwrap();
          toast.show(`Added ${step} case(s) to cart.`, 'success');
        } else {
          await dispatch(updateCartItem({ productId, quantity: current + 1 })).unwrap();
          toast.show('Cart quantity increased.', 'success');
        }
      } catch (cartError: any) {
        toast.show(cartError || 'Failed to update cart', 'error');
      }
    },
    [dispatch, items, getCartQuantityForProduct]
  );

  const decrementProduct = useCallback(
    async (productId: string) => {
      const current = getCartQuantityForProduct(productId);
      if (current <= 0) return;
      try {
        if (current === 1) {
          await dispatch(removeCartItem(productId)).unwrap();
          toast.show('Item removed from cart.', 'success');
        } else {
          await dispatch(updateCartItem({ productId, quantity: current - 1 })).unwrap();
          toast.show('Cart quantity decreased.', 'success');
        }
      } catch (cartError: any) {
        toast.show(cartError || 'Failed to update cart', 'error');
      }
    },
    [dispatch, getCartQuantityForProduct]
  );

  const renderProductItem = useCallback(
    ({ item }: { item: Product }) => (
      <View style={styles.productCell}>
        <ProductCard
          product={item}
          compact
          cartCount={getCartQuantityForProduct(item._id)}
          onView={() => navigation.navigate('ProductDetails', { productId: item._id, product: item })}
          onIncrementCart={() => incrementProduct(item._id, item.minOrderQuantity || 1)}
          onDecrementCart={() => decrementProduct(item._id)}
          onOpenCart={() => navigation.navigate('Cart')}
        />
      </View>
    ),
    [getCartQuantityForProduct, incrementProduct, decrementProduct, navigation]
  );

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* BRAND & USER HEADER */}
      <View style={styles.headerRow}>
        <View style={styles.logoBadge}>
          <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.greetingWrap}>
          <View style={styles.companyRow}>
            <Text style={styles.companyName}>AP Enterprises</Text>
            <View style={styles.b2bBadge}>
              <Text style={styles.b2bBadgeText}>PREMIUM B2B SUPPLY</Text>
            </View>
          </View>
          <Text style={styles.greeting}>
            Welcome, {user?.name?.split(' ')[0] || 'Wholesale Buyer'}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Open menu"
          style={styles.menuButton}
          onPress={() => setDrawerOpen((prev) => !prev)}
        >
          <MaterialCommunityIcons name="menu" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* BEVERAGE SEARCH BAR */}
      <View style={styles.searchField}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.primary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search wholesale beverages, brands, cans, cases..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search beverages"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8} style={{ marginRight: 6 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Filter beverages"
          style={styles.filterButton}
          onPress={() => requestProducts()}
        >
          <MaterialCommunityIcons name="tune-variant" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* BEVERAGE CATEGORY FILTER PILLS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
        keyboardShouldPersistTaps="handled"
      >
        {['', ...BEVERAGE_CATEGORIES].map((cat) => {
          const isActive = category === cat;
          return (
            <TouchableOpacity
              key={cat || 'all'}
              onPress={() => {
                setCategory(cat);
                requestProducts(cat, search, 1);
              }}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                {cat || 'All Beverages'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* WHOLESALE DEALS BANNER */}
      <View style={styles.dealBanner}>
        <View style={styles.dealCopy}>
          <View style={styles.dealKicker}>
            <MaterialCommunityIcons name="lightning-bolt" size={14} color={colors.citrus} />
            <Text style={styles.dealKickerText}>BULK PALLET & CASE SAVINGS</Text>
          </View>
          <Text style={styles.dealTitle}>Direct Beverage Wholesale</Text>
          <Text style={styles.dealSubtitle}>
            Save up to 10% on tiered volume case orders. Fast fulfillment across all categories.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="bottle-soda-outline"
          size={52}
          color="#92400E"
          style={styles.dealIcon}
        />
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{items.length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>100%</Text>
            <Text style={styles.statLabel}>Beverages</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>MOQ 1+</Text>
            <Text style={styles.statLabel}>Flexible</Text>
          </View>
        </View>
      </View>

      {/* CATALOG SECTION TITLE */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {category ? `${category} Catalog` : 'Wholesale Beverage Catalog'}
          </Text>
          <Text style={styles.sectionHint}>Live stock • Tiered case pricing • Verified quality</Text>
        </View>
        <MaterialCommunityIcons name="arrow-top-right" size={19} color={colors.primary} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        onEndReachedThreshold={0.35}
        onEndReached={loadNextPage}
        refreshing={isRefreshing}
        onRefresh={async () => {
          setIsRefreshing(true);
          await dispatch(fetchProducts({ page: 1, limit: 12, search: search.trim(), category }));
          setIsRefreshing(false);
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonGrid}>
              {skeletonCards.map((index) => (
                <View style={styles.productCell} key={`skeleton-${index}`}>
                  <ProductCardSkeleton />
                </View>
              ))}
            </View>
          ) : error ? (
            <ErrorView message={error} />
          ) : (
            <EmptyState
              icon="bottle-soda-classic-outline"
              title="No beverages found"
              description="We couldn't find beverages matching your search filters."
              actionLabel="Show all beverages"
              onAction={() => {
                dispatch(clearProducts());
                requestProducts('', '', 1);
                setSearch('');
                setCategory('');
              }}
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {loadingMore ? (
              <View style={styles.footerSkeletonRow}>
                <ProductCardSkeleton />
                <ProductCardSkeleton />
              </View>
            ) : null}
            <View style={styles.pagination}>
              <Pressable
                disabled={page <= 1 || loading}
                onPress={() => requestProducts(category, search, page - 1)}
                style={[styles.pageButton, (page <= 1 || loading) && styles.pageButtonDisabled]}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={18}
                  color={page <= 1 || loading ? colors.textMuted : colors.primary}
                />
                <Text style={[styles.pageButtonText, (page <= 1 || loading) && styles.pageButtonTextDisabled]}>
                  Previous
                </Text>
              </Pressable>
              <Text style={styles.pageText}>
                Page {page} of {Math.max(totalPages, 1)}
              </Text>
              <Pressable
                disabled={page >= totalPages || loadingMore}
                onPress={loadNextPage}
                style={[styles.pageButton, (page >= totalPages || loadingMore) && styles.pageButtonDisabled]}
              >
                <Text style={[styles.pageButtonText, (page >= totalPages || loadingMore) && styles.pageButtonTextDisabled]}>
                  Next
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={page >= totalPages || loadingMore ? colors.textMuted : colors.primary}
                />
              </Pressable>
            </View>
          </View>
        }
        renderItem={renderProductItem}
      />

      {/* DRAWER MENU */}
      {drawerOpen ? (
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          <View style={[styles.drawerPanel, { paddingTop: insets.top + 16 }]}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerBrandRow}>
                <Image source={logoSource} style={styles.drawerLogo} resizeMode="contain" />
                <View>
                  <Text style={styles.drawerTitle}>AP Enterprises</Text>
                  <Text style={styles.drawerSubtitle}>Premium B2B Beverage Supply</Text>
                </View>
              </View>
              <Pressable onPress={() => setDrawerOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                navigation.navigate('Cart');
                setDrawerOpen(false);
              }}
            >
              <MaterialCommunityIcons name="cart-outline" size={20} color={colors.primary} />
              <Text style={styles.drawerItemText}>Beverage Cart</Text>
              {totalCartItems > 0 && (
                <View style={styles.drawerBadge}>
                  <Text style={styles.drawerBadgeText}>{totalCartItems}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                navigation.navigate('Orders');
                setDrawerOpen(false);
              }}
            >
              <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={colors.primary} />
              <Text style={styles.drawerItemText}>My Orders & Tracking</Text>
            </TouchableOpacity>
            {(user?.role === 'seller' || user?.role === 'admin') && (
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  navigation.navigate(user.role === 'admin' ? 'AdminDashboard' : 'SellerDashboard');
                  setDrawerOpen(false);
                }}
              >
                <MaterialCommunityIcons name="storefront-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>
                  {user.role === 'admin' ? 'Admin Console' : 'Seller Portal'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setDrawerOpen(false);
                setDeveloperNoteVisible(true);
              }}
            >
              <MaterialCommunityIcons name="code-tags" size={20} color={colors.primary} />
              <Text style={styles.drawerItemText}>Developer Note</Text>
              <View style={[styles.drawerBadge, { backgroundColor: colors.warningSurface, borderWidth: 1, borderColor: colors.warningBorder }]}>
                <Text style={[styles.drawerBadgeText, { color: '#92400E', fontSize: 10 }]}>Trial</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerItem, styles.drawerLogout]}
              onPress={async () => {
                setDrawerOpen(false);
                setLoggingOut(true);
                await new Promise((resolve) => setTimeout(() => resolve(true), 1600));
                dispatch(logout());
              }}
            >
              <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
              <Text style={[styles.drawerItemText, { color: colors.danger }]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <DeveloperNoteModal
        visible={developerNoteVisible}
        onClose={() => setDeveloperNoteVisible(false)}
      />

      <BeverageLoader
        visible={loggingOut}
        mode="auth"
        title="AP Enterprises"
        subtitle="Signing out of your wholesale account..."
      />

      {/* FLOATING CART BUTTON */}
      <Pressable
        accessibilityLabel={`Open beverage cart with ${totalCartItems} items`}
        onPress={() => navigation.navigate('Cart')}
        style={[styles.floatingCart, { bottom: Math.max(16, insets.bottom + 12) }]}
      >
        <MaterialCommunityIcons name="cart-outline" size={20} color={colors.white} />
        <Text style={styles.floatingCartText}>Cart</Text>
        <Animated.View style={[styles.cartBadge, { transform: [{ scale: cartScale }] }]}>
          <Text style={styles.cartBadgeText}>{totalCartItems}</Text>
        </Animated.View>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120
  },
  headerSection: {
    marginBottom: 4
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...shadows.card
  },
  logoImage: {
    width: '100%',
    height: '100%'
  },
  greetingWrap: {
    flex: 1
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  companyName: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  b2bBadge: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  b2bBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  greeting: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 1
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchField: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 14,
    ...shadows.card
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 8
  },
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.infoSurface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryRow: {
    gap: 8,
    paddingBottom: 16
  },
  categoryChip: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700'
  },
  categoryTextActive: {
    color: colors.white,
    fontWeight: '800'
  },
  dealBanner: {
    position: 'relative',
    borderRadius: radius.lg,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginBottom: 20,
    ...shadows.card
  },
  dealCopy: {
    paddingRight: 48
  },
  dealIcon: {
    position: 'absolute',
    top: 14,
    right: 14,
    opacity: 0.8
  },
  dealKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dealKickerText: {
    color: '#92400E',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  dealTitle: {
    color: '#78350F',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: 4
  },
  dealSubtitle: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  statNumber: {
    color: '#78350F',
    fontSize: 15,
    fontWeight: '900'
  },
  statLabel: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900'
  },
  sectionHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12
  },
  productCell: {
    width: '48.5%'
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  footer: {
    gap: 12,
    paddingTop: 10
  },
  footerSkeletonRow: {
    flexDirection: 'row',
    gap: 12
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
    paddingTop: 8
  },
  pageButton: {
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 4
  },
  pageButtonDisabled: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border
  },
  pageButtonText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '800'
  },
  pageButtonTextDisabled: {
    color: colors.textMuted
  },
  pageText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  floatingCart: {
    position: 'absolute',
    right: 16,
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingLeft: 18,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.floating
  },
  floatingCartText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900'
  },
  cartBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cartBadgeText: {
    color: colors.primaryPressed,
    fontSize: 12.5,
    fontWeight: '900'
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 10
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)'
  },
  drawerPanel: {
    width: 270,
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    gap: 10,
    borderLeftWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 6
  },
  drawerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  drawerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10
  },
  drawerTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '900'
  },
  drawerSubtitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  drawerItem: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14
  },
  drawerItemText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '800',
    flex: 1
  },
  drawerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  drawerBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800'
  },
  drawerLogout: {
    marginTop: 12,
    backgroundColor: colors.dangerSurface
  }
});
