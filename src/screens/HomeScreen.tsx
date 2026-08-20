import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  LayoutAnimation,
  Pressable,
  RefreshControl,
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
import { PromoBannerCarousel } from '../components/PromoBannerCarousel';
import { colors, radius, shadows } from '../constants/theme';
import { Product } from '../constants/types';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { logout } from '../redux/slices/authSlice';
import { addCartItem, fetchCart, removeCartItem, updateCartItem } from '../redux/slices/cartSlice';
import { clearProducts, fetchProducts, fetchCategories } from '../redux/slices/productSlice';
import { loadWishlist } from '../redux/slices/wishlistSlice';
import { toast } from '../utils/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.78);

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const CATEGORIES = [
  { id: '', label: 'All Products', icon: 'storefront-outline' },
  { id: 'Eggs', label: 'Eggs', icon: 'egg-outline' },
  { id: 'Beverages', label: 'Beverages', icon: 'cup-water' },
  { id: 'Existing Products', label: 'Wholesale Supplies', icon: 'cube-outline' }
];

export const HomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { items, loading, loadingMore, error, page, totalPages } = useAppSelector((state) => state.products);
  const { user } = useAppSelector((state) => state.auth);
  const { items: cartItems } = useAppSelector((state) => state.cart);
  const { items: wishlistItems } = useAppSelector((state) => state.wishlist);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(route.params?.initialCategory || '');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'featured' | 'bestseller' | 'price_low' | 'price_high'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [developerNoteVisible, setDeveloperNoteVisible] = useState(false);

  // Drawer animation state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cartScale = useRef(new Animated.Value(1)).current;

  // Sync route params if category passed from drawer
  useEffect(() => {
    if (route.params?.initialCategory !== undefined) {
      setCategory(route.params.initialCategory);
    }
  }, [route.params?.initialCategory]);

  useEffect(() => {
    dispatch(fetchProducts({ page: 1, limit: 16 }));
    dispatch(fetchCategories());
    dispatch(fetchCart());
    dispatch(loadWishlist());
  }, [dispatch]);


  // Drawer Open / Close Animation
  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true
      })
    ]).start();
  };

  const closeDrawer = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true
      })
    ]).start(() => {
      setDrawerOpen(false);
      if (callback) callback();
    });
  };

  // Instant filter or debounced search
  useEffect(() => {
    let sortBy = 'newest';
    let isFeatured: boolean | undefined;
    let isBestSeller: boolean | undefined;

    if (selectedFilter === 'featured') isFeatured = true;
    if (selectedFilter === 'bestseller') isBestSeller = true;
    if (selectedFilter === 'price_low') sortBy = 'price_asc';
    if (selectedFilter === 'price_high') sortBy = 'price_desc';

    const delay = search ? 280 : 0;
    const timer = setTimeout(() => {
      dispatch(
        fetchProducts({
          page: 1,
          limit: 16,
          search: search.trim(),
          category,
          isFeatured,
          isBestSeller,
          sortBy
        })
      );
    }, delay);

    return () => clearTimeout(timer);
  }, [dispatch, search, category, selectedFilter]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await dispatch(
      fetchProducts({
        page: 1,
        limit: 16,
        search: search.trim(),
        category
      })
    );
    await dispatch(fetchCart());
    await dispatch(loadWishlist());
    setIsRefreshing(false);
  }, [dispatch, search, category]);

  const loadNextPage = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    dispatch(
      fetchProducts({
        page: page + 1,
        limit: 16,
        search: search.trim(),
        category
      })
    );
  }, [dispatch, loadingMore, page, totalPages, search, category]);

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

  const totalCartItems = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems]
  );

  useEffect(() => {
    if (totalCartItems > 0) {
      Animated.sequence([
        Animated.timing(cartScale, {
          toValue: 1.25,
          duration: 120,
          useNativeDriver: true
        }),
        Animated.spring(cartScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [totalCartItems, cartScale]);

  const incrementProduct = useCallback(
    async (productId: string, minOrderQuantity: number) => {
      const target = items.find((item) => item._id === productId);
      if (target && target.stock <= 0) {
        toast.error('This product is currently out of stock.');
        return;
      }
      const current = getCartQuantityForProduct(productId);
      try {
        if (current <= 0) {
          const step = Math.max(1, minOrderQuantity || 1);
          await dispatch(addCartItem({ productId, quantity: step })).unwrap();
          toast.success(`Added ${step} ${target?.unit || 'unit'}(s) to cart 🛒`);
        } else {
          await dispatch(updateCartItem({ productId, quantity: current + 1 })).unwrap();
          toast.success('Cart updated 🛒');
        }
      } catch (cartError: any) {
        toast.error(cartError || 'Failed to update cart');
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
          toast.info('Item removed from cart');
        } else {
          await dispatch(updateCartItem({ productId, quantity: current - 1 })).unwrap();
          toast.info('Cart quantity decreased');
        }
      } catch (cartError: any) {
        toast.error(cartError || 'Failed to update cart');
      }
    },
    [dispatch, getCartQuantityForProduct]
  );

  const handleSelectCategory = useCallback((catId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategory(catId);
  }, []);

  const handleSelectFilter = useCallback((filter: 'all' | 'featured' | 'bestseller' | 'price_low' | 'price_high') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedFilter(filter);
  }, []);

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

  const renderHeader = useMemo(() => (
    <View style={styles.headerSection}>
      {/* BRAND & USER APP BAR */}
      <View style={styles.headerRow}>
        <View style={styles.logoBadge}>
          <Image source={logoSource} style={styles.logoImage} resizeMode="cover" />
        </View>
        <View style={styles.greetingWrap}>
          <View style={styles.companyRow}>
            <Text style={styles.companyName}>AP Enterprises</Text>
            <View style={styles.b2bBadge}>
              <Text style={styles.b2bBadgeText}>B2B COMMERCE</Text>
            </View>
          </View>
          <Text style={styles.greeting} numberOfLines={1}>
            Hello, {user?.name?.split(' ')[0] || 'Wholesale Buyer'}
          </Text>
        </View>
        <View style={styles.topActionBtns}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Wishlist')}
            hitSlop={6}
            accessibilityLabel="Open wishlist"
          >
            <Ionicons name="heart-outline" size={21} color={colors.text} />
            {wishlistItems.length > 0 && (
              <View style={styles.iconBadge}>
                <Text style={styles.iconBadgeText}>{wishlistItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={openDrawer}
            hitSlop={6}
            accessibilityLabel="Open sidebar menu"
          >
            <MaterialCommunityIcons name="menu" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={19} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search eggs, coca-cola, pepsi, crates..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* HERO / PROMO BANNER CAROUSEL */}
      {!search && (
        <PromoBannerCarousel
          onSelectCategory={handleSelectCategory}
        />
      )}

      {/* CATEGORY TABS */}
      <View style={styles.categorySection}>
        <Text style={styles.sectionHeading}>Product Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id || 'all'}
                activeOpacity={0.8}
                onPress={() => handleSelectCategory(cat.id)}
                style={[styles.categoryTab, isSelected && styles.categoryTabActive]}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={18}
                  color={isSelected ? colors.white : colors.primary}
                />
                <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* FILTER CHIPS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipScroll}>
        <TouchableOpacity
          onPress={() => handleSelectFilter('all')}
          style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'all' && styles.filterChipTextActive]}>
            All Items
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSelectFilter('featured')}
          style={[styles.filterChip, selectedFilter === 'featured' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'featured' && styles.filterChipTextActive]}>
            ⭐ Featured
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSelectFilter('bestseller')}
          style={[styles.filterChip, selectedFilter === 'bestseller' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'bestseller' && styles.filterChipTextActive]}>
            🔥 Bestsellers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSelectFilter('price_low')}
          style={[styles.filterChip, selectedFilter === 'price_low' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'price_low' && styles.filterChipTextActive]}>
            Price: Low to High
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSelectFilter('price_high')}
          style={[styles.filterChip, selectedFilter === 'price_high' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'price_high' && styles.filterChipTextActive]}>
            Price: High to Low
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* PRODUCTS SECTION TITLE */}
      <View style={styles.catalogHeadingRow}>
        <Text style={styles.catalogHeading}>
          {category ? `${category} Catalog` : 'Wholesale Catalog'}
        </Text>
        <Text style={styles.catalogCount}>
          {items.length} item{items.length === 1 ? '' : 's'} available
        </Text>
      </View>
    </View>
  ), [user?.name, wishlistItems.length, search, category, selectedFilter, items.length, handleSelectCategory, handleSelectFilter]);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonGrid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.productCell}>
                  <ProductCardSkeleton compact />
                </View>
              ))}
            </View>
          ) : error ? (
            <ErrorView message={error} onRetry={() => dispatch(fetchProducts({ page: 1, limit: 16, category }))} />
          ) : (
            <EmptyState
              title="No Products Found"
              description="No wholesale beverages or egg supplies matched your search/filter criteria."
              actionLabel="Reset Filters"
              onAction={() => {
                setSearch('');
                setCategory('');
                setSelectedFilter('all');
              }}
            />
          )
        }
        ListFooterComponent={
          items.length > 0 && totalPages > 1 ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                onPress={() => {
                  if (page > 1) {
                    dispatch(fetchProducts({ page: page - 1, limit: 16, search: search.trim(), category }));
                  }
                }}
                disabled={page <= 1}
                style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
              >
                <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.textMuted : colors.primary} />
                <Text style={[styles.pageButtonText, page <= 1 && styles.pageButtonTextDisabled]}>Previous</Text>
              </TouchableOpacity>

              <Text style={styles.pageIndicator}>
                Page {page} of {totalPages}
              </Text>

              <TouchableOpacity
                onPress={loadNextPage}
                disabled={page >= totalPages || loadingMore}
                style={[styles.pageButton, (page >= totalPages || loadingMore) && styles.pageButtonDisabled]}
              >
                <Text style={[styles.pageButtonText, (page >= totalPages || loadingMore) && styles.pageButtonTextDisabled]}>
                  Next
                </Text>
                <Ionicons name="chevron-forward" size={16} color={page >= totalPages || loadingMore ? colors.textMuted : colors.primary} />
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={renderProductItem}
      />

      {/* ANIMATED SLIDE-IN NAVIGATION DRAWER */}
      {drawerOpen && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {/* Fading Backdrop */}
          <Animated.View style={[styles.drawerBackdrop, { opacity: overlayAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDrawer()} />
          </Animated.View>

          {/* Sliding Panel */}
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
            {/* BRAND HEADER */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerBrandRow}>
                <Image source={logoSource} style={styles.drawerLogo} resizeMode="cover" />
                <View>
                  <Text style={styles.drawerTitle}>AP Enterprises</Text>
                  <Text style={styles.drawerSubtitle}>Beverages & Eggs Supply</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => closeDrawer()} hitSlop={8} style={styles.drawerCloseBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerScroll}>
              {/* NAVIGATION MENU ITEMS */}
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => { setCategory(''); setSelectedFilter('all'); })}
              >
                <Ionicons name="home-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Home & All Products</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => setCategory('Eggs'))}
              >
                <MaterialCommunityIcons name="egg-outline" size={20} color="#D97706" />
                <Text style={styles.drawerItemText}>Farm Fresh Eggs</Text>
                <View style={[styles.drawerBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.drawerBadgeText, { color: '#92400E' }]}>Trays & Crates</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => setCategory('Beverages'))}
              >
                <MaterialCommunityIcons name="cup-water" size={20} color="#0284C7" />
                <Text style={styles.drawerItemText}>Chilled Beverages</Text>
                <View style={[styles.drawerBadge, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={[styles.drawerBadgeText, { color: '#0369A1' }]}>Bulk Cans</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => setCategory('Existing Products'))}
              >
                <MaterialCommunityIcons name="cube-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Wholesale Supplies</Text>
              </TouchableOpacity>

              <View style={styles.drawerDivider} />

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => navigation.navigate('Wishlist'))}
              >
                <Ionicons name="heart-outline" size={20} color="#EF4444" />
                <Text style={styles.drawerItemText}>My Wishlist</Text>
                {wishlistItems.length > 0 && (
                  <View style={[styles.drawerBadge, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.drawerBadgeText, { color: '#DC2626' }]}>{wishlistItems.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => navigation.navigate('Cart'))}
              >
                <Ionicons name="cart-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Shopping Cart</Text>
                {totalCartItems > 0 && (
                  <View style={styles.drawerBadge}>
                    <Text style={styles.drawerBadgeText}>{totalCartItems}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => navigation.navigate('Orders'))}
              >
                <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>My Orders & Tracking</Text>
              </TouchableOpacity>

              {(user?.role === 'seller' || user?.role === 'admin') && (
                <>
                  <View style={styles.drawerDivider} />
                  <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => closeDrawer(() => navigation.navigate(user.role === 'admin' ? 'AdminDashboard' : 'SellerDashboard'))}
                  >
                    <MaterialCommunityIcons name="shield-crown-outline" size={20} color={colors.primary} />
                    <Text style={styles.drawerItemText}>
                      {user.role === 'admin' ? 'Admin Console' : 'Seller Portal'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.drawerDivider} />

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => setDeveloperNoteVisible(true))}
              >
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Developer Note</Text>
                <View style={[styles.drawerBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.drawerBadgeText, { color: '#92400E' }]}>Trial</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerItem, styles.drawerLogout]}
                onPress={() => {
                  closeDrawer(() => {
                    dispatch(logout());
                  });
                }}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                <Text style={[styles.drawerItemText, { color: colors.danger }]}>Log Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* DEVELOPER NOTE MODAL */}
      <DeveloperNoteModal
        visible={developerNoteVisible}
        onClose={() => setDeveloperNoteVisible(false)}
      />

      {/* LOGOUT LOADER */}
      <BeverageLoader
        visible={loggingOut}
        mode="auth"
        title="AP Enterprises"
        subtitle="Signing out of your wholesale account..."
      />

      {/* FLOATING CART ACTION */}
      <TouchableOpacity
        activeOpacity={0.9}
        accessibilityLabel={`Open shopping cart with ${totalCartItems} items`}
        onPress={() => navigation.navigate('Cart')}
        style={[styles.floatingCart, { bottom: Math.max(16, insets.bottom + 12) }]}
      >
        <Ionicons name="cart" size={20} color={colors.white} />
        <Text style={styles.floatingCartText}>Cart</Text>
        <Animated.View style={[styles.cartBadge, { transform: [{ scale: cartScale }] }]}>
          <Text style={styles.cartBadgeText}>{totalCartItems}</Text>
        </Animated.View>
      </TouchableOpacity>
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
    paddingTop: 8,
    paddingBottom: 110
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: 12
  },
  productCell: {
    flex: 1,
    marginBottom: 12
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  headerSection: {
    marginBottom: 12
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
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
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  b2bBadge: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  b2bBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  greeting: {
    color: colors.navy,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 1
  },
  topActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    position: 'relative'
  },
  iconBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  iconBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900'
  },
  searchContainer: {
    marginBottom: 12
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 46,
    gap: 8,
    ...shadows.card
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.text,
    paddingVertical: 8
  },
  heroSection: {
    marginBottom: 14
  },
  heroCard: {
    borderRadius: radius.lg,
    padding: 16,
    marginRight: 12,
    justifyContent: 'space-between',
    minHeight: 140,
    ...shadows.card
  },
  heroTextContent: {
    gap: 4
  },
  heroTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: 4
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900'
  },
  heroSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
    maxWidth: '85%'
  },
  heroShopBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: 8
  },
  heroShopText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '900'
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 8
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.primary
  },
  categorySection: {
    marginBottom: 10
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.navy,
    marginBottom: 8
  },
  categoryScroll: {
    gap: 8
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryTabText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.text
  },
  categoryTabTextActive: {
    color: colors.white
  },
  filterChipScroll: {
    gap: 6,
    paddingVertical: 4,
    marginBottom: 10
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  filterChipActive: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '800'
  },
  catalogHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
    marginBottom: 6
  },
  catalogHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.navy
  },
  catalogCount: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '600'
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginTop: 6
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  pageButtonDisabled: {
    opacity: 0.4
  },
  pageButtonText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.primary
  },
  pageButtonTextDisabled: {
    color: colors.textMuted
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary
  },
  // Animated Drawer Styles
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    zIndex: 99
  },
  drawerPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    zIndex: 100,
    ...shadows.floating
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8
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
    fontSize: 18,
    fontWeight: '900'
  },
  drawerSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  drawerScroll: {
    paddingVertical: 8,
    gap: 4
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radius.md
  },
  drawerItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  drawerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  drawerBadgeText: {
    color: colors.white,
    fontSize: 10.5,
    fontWeight: '800'
  },
  drawerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6
  },
  drawerLogout: {
    marginTop: 8
  },
  floatingCart: {
    position: 'absolute',
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    ...shadows.floating,
    zIndex: 10
  },
  floatingCartText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800'
  },
  cartBadge: {
    backgroundColor: '#EF4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  cartBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900'
  }
});
