import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPromptAction, AuthPromptModal } from '../components/AuthPromptModal';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ProductCardSkeleton';
import { EmptyState, ErrorView } from '../components/StateViews';
import { colors, radius, shadows } from '../constants/theme';
import { Product } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { setPendingAction } from '../redux/slices/authSlice';
import { addCartItem, fetchCart, removeCartItem, updateCartItem } from '../redux/slices/cartSlice';
import { fetchCategories, fetchProducts, setCachedProducts } from '../redux/slices/productSlice';
import { loadWishlist } from '../redux/slices/wishlistSlice';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Catalog'>;

const CATEGORIES = [
  { id: '', label: 'All Products', icon: 'storefront-outline' },
  { id: 'Eggs', label: 'Eggs', icon: 'egg-outline' },
  { id: 'Beverages', label: 'Beverages', icon: 'cup-water' },
  { id: 'Existing Products', label: 'Wholesale Supplies', icon: 'cube-outline' }
];

const AnimatedProductCell: React.FC<{
  children: React.ReactNode;
  index: number;
}> = React.memo(({ children, index }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        delay: Math.min(index, 6) * 25,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        delay: Math.min(index, 6) * 25,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [opacity, translateY, index]);

  return (
    <Animated.View style={[styles.productCell, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
});

AnimatedProductCell.displayName = 'AnimatedProductCell';

export const CatalogScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { items, loading, loadingMore, error, page, totalPages, categories: backendCategories } = useAppSelector(
    (state) => state.products
  );
  const { user } = useAppSelector((state) => state.auth);
  const { items: cartItems } = useAppSelector((state) => state.cart);
  const { items: wishlistItems } = useAppSelector((state) => state.wishlist);

  const [search, setSearch] = useState(route.params?.initialSearch || '');
  const [category, setCategory] = useState(route.params?.initialCategory || '');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'featured' | 'bestseller' | 'price_low' | 'price_high'>(
    route.params?.initialFilter || 'all'
  );
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auth Prompt Modal State for Guest Users
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalAction, setAuthModalAction] = useState<AuthPromptAction>('general');
  const [authModalProduct, setAuthModalProduct] = useState<Product | null>(null);
  const [authModalQuantity, setAuthModalQuantity] = useState(1);

  const triggerAuthPrompt = useCallback(
    (action: AuthPromptAction, product?: Product, quantity?: number) => {
      setAuthModalAction(action);
      setAuthModalProduct(product || null);
      setAuthModalQuantity(quantity || 1);
      setAuthModalVisible(true);
    },
    []
  );

  const handleAuthModalSignIn = useCallback(() => {
    if (authModalProduct) {
      dispatch(
        setPendingAction({
          type: authModalAction === 'wishlist' ? 'WISHLIST' : authModalAction === 'buy_now' ? 'BUY_NOW' : 'ADD_TO_CART',
          productId: authModalProduct._id,
          product: authModalProduct,
          quantity: authModalQuantity
        })
      );
    }
    setAuthModalVisible(false);
    navigation.navigate('Login');
  }, [dispatch, authModalProduct, authModalAction, authModalQuantity, navigation]);

  const handleAuthModalSignUp = useCallback(() => {
    if (authModalProduct) {
      dispatch(
        setPendingAction({
          type: authModalAction === 'wishlist' ? 'WISHLIST' : authModalAction === 'buy_now' ? 'BUY_NOW' : 'ADD_TO_CART',
          productId: authModalProduct._id,
          product: authModalProduct,
          quantity: authModalQuantity
        })
      );
    }
    setAuthModalVisible(false);
    navigation.navigate('Register');
  }, [dispatch, authModalProduct, authModalAction, authModalQuantity, navigation]);

  // In-Memory Category & Filter Cache for Instant Switching
  const categoryCacheRef = useRef<Record<string, { items: Product[]; page: number; totalPages: number }>>({});
  const latestRequestId = useRef(0);
  const cartScale = useRef(new Animated.Value(1)).current;

  // Master execution function for product data fetching & caching
  const executeProductFetch = useCallback(
    async (
      targetCategory: string,
      targetSearch: string,
      targetFilter: 'all' | 'featured' | 'bestseller' | 'price_low' | 'price_high',
      targetPage: number = 1,
      forceRefresh: boolean = false
    ) => {
      let sortBy = 'newest';
      let isFeatured: boolean | undefined;
      let isBestSeller: boolean | undefined;

      if (targetFilter === 'featured') isFeatured = true;
      if (targetFilter === 'bestseller') isBestSeller = true;
      if (targetFilter === 'price_low') sortBy = 'price_asc';
      if (targetFilter === 'price_high') sortBy = 'price_desc';

      const cacheKey = `${targetCategory}_${targetSearch.trim().toLowerCase()}_${targetFilter}_${targetPage}`;

      if (!forceRefresh && categoryCacheRef.current[cacheKey]) {
        const cached = categoryCacheRef.current[cacheKey];
        dispatch(setCachedProducts({ items: cached.items, page: cached.page, totalPages: cached.totalPages }));
        setIsCategoryLoading(false);

        // Background silent refresh for live stock updates without visual flicker
        dispatch(
          fetchProducts({
            page: targetPage,
            limit: 16,
            search: targetSearch.trim(),
            category: targetCategory,
            isFeatured,
            isBestSeller,
            sortBy
          })
        )
          .unwrap()
          .then((res) => {
            if (res?.data && res?.pagination) {
              categoryCacheRef.current[cacheKey] = {
                items: res.data,
                page: res.pagination.page,
                totalPages: res.pagination.totalPages
              };
            }
          })
          .catch(() => {});
        return;
      }

      if (targetPage === 1) {
        setIsCategoryLoading(true);
      }

      const reqId = ++latestRequestId.current;

      try {
        const res = await dispatch(
          fetchProducts({
            page: targetPage,
            limit: 16,
            search: targetSearch.trim(),
            category: targetCategory,
            isFeatured,
            isBestSeller,
            sortBy
          })
        ).unwrap();

        if (reqId === latestRequestId.current) {
          if (res?.data && res?.pagination) {
            categoryCacheRef.current[cacheKey] = {
              items: res.data,
              page: res.pagination.page,
              totalPages: res.pagination.totalPages
            };
          }
        }
      } catch {
        // Handled via Redux error state
      } finally {
        if (reqId === latestRequestId.current) {
          setIsCategoryLoading(false);
        }
      }
    },
    [dispatch]
  );

  // Sync route params if changed
  useEffect(() => {
    if (route.params?.initialCategory !== undefined) {
      setCategory(route.params.initialCategory);
    }
    if (route.params?.initialSearch !== undefined) {
      setSearch(route.params.initialSearch);
    }
    if (route.params?.initialFilter !== undefined) {
      setSelectedFilter(route.params.initialFilter);
    }
  }, [route.params]);

  // Initial metadata load
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Debounced search and category/filter fetch effect
  useEffect(() => {
    const isTyping = search.trim().length > 0;
    const delay = isTyping ? 350 : 0;
    const timer = setTimeout(() => {
      executeProductFetch(category, search, selectedFilter, 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [search, category, selectedFilter, executeProductFetch]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    categoryCacheRef.current = {};
    await Promise.all([
      executeProductFetch(category, search, selectedFilter, 1, true),
      dispatch(fetchCategories()),
      user ? dispatch(fetchCart()) : Promise.resolve(),
      user ? dispatch(loadWishlist()) : Promise.resolve()
    ]);
    setIsRefreshing(false);
  }, [category, search, selectedFilter, executeProductFetch, dispatch, user]);

  const loadNextPage = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    executeProductFetch(category, search, selectedFilter, page + 1, false);
  }, [loadingMore, page, totalPages, category, search, selectedFilter, executeProductFetch]);

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

      if (!user) {
        haptics.lightImpact();
        if (target) {
          triggerAuthPrompt('cart', target, minOrderQuantity);
        } else {
          triggerAuthPrompt('cart');
        }
        return;
      }

      if (target && target.stock <= 0) {
        haptics.errorNotification();
        toast.error('This product is currently out of stock.');
        return;
      }
      haptics.mediumImpact();
      const current = getCartQuantityForProduct(productId);
      try {
        if (current <= 0) {
          const step = Math.max(1, minOrderQuantity || 1);
          await dispatch(addCartItem({ productId, quantity: step })).unwrap();
          toast.success(`Added ${step} ${target?.unit || 'unit'}(s) to cart.`);
        } else {
          await dispatch(updateCartItem({ productId, quantity: current + 1 })).unwrap();
          toast.success('Cart updated.');
        }
      } catch (cartError: any) {
        haptics.errorNotification();
        toast.error(cartError || 'Failed to update cart');
      }
    },
    [dispatch, items, getCartQuantityForProduct, user, triggerAuthPrompt]
  );

  const decrementProduct = useCallback(
    async (productId: string) => {
      if (!user) {
        haptics.lightImpact();
        triggerAuthPrompt('cart');
        return;
      }
      haptics.selection();
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
    [dispatch, getCartQuantityForProduct, user, triggerAuthPrompt]
  );

  const handleSelectCategory = useCallback(
    (catId: string) => {
      if (catId === category) return;
      haptics.selection();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCategory(catId);
      const cacheKey = `${catId}_${search.trim().toLowerCase()}_${selectedFilter}_1`;
      if (!categoryCacheRef.current[cacheKey]) {
        setIsCategoryLoading(true);
      }
      executeProductFetch(catId, search, selectedFilter, 1);
    },
    [category, search, selectedFilter, executeProductFetch]
  );

  const handleSelectFilter = useCallback(
    (filter: 'all' | 'featured' | 'bestseller' | 'price_low' | 'price_high') => {
      if (filter === selectedFilter) return;
      haptics.selection();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedFilter(filter);
      const cacheKey = `${category}_${search.trim().toLowerCase()}_${filter}_1`;
      if (!categoryCacheRef.current[cacheKey]) {
        setIsCategoryLoading(true);
      }
      executeProductFetch(category, search, filter, 1);
    },
    [selectedFilter, category, search, executeProductFetch]
  );

  // Android Back Button handler: progressively step back state before exiting
  useEffect(() => {
    const backAction = () => {
      if (search.length > 0) {
        setSearch('');
        return true;
      }
      if (category !== '') {
        setCategory('');
        return true;
      }
      if (selectedFilter !== 'all') {
        setSelectedFilter('all');
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [search, category, selectedFilter]);

  const getCategoryCount = useCallback(
    (catId: string) => {
      if (!catId) {
        return backendCategories.reduce((sum, c) => sum + (c.count || 0), 0);
      }
      const match = backendCategories.find((c) => c.name.toLowerCase() === catId.toLowerCase());
      return match ? match.count : null;
    },
    [backendCategories]
  );

  const renderProductItem = useCallback(
    ({ item, index }: { item: Product; index: number }) => (
      <AnimatedProductCell index={index}>
        <ProductCard
          product={item}
          compact
          cartCount={getCartQuantityForProduct(item._id)}
          onView={() => navigation.navigate('ProductDetails', { productId: item._id, product: item })}
          onIncrementCart={() => incrementProduct(item._id, item.minOrderQuantity || 1)}
          onDecrementCart={() => decrementProduct(item._id)}
          onOpenCart={() => {
            if (!user) {
              triggerAuthPrompt('cart');
            } else {
              navigation.navigate('Cart');
            }
          }}
          onRequireAuth={(action, product, qty) =>
            triggerAuthPrompt(action === 'wishlist' ? 'wishlist' : 'cart', product, qty)
          }
        />
      </AnimatedProductCell>
    ),
    [getCartQuantityForProduct, incrementProduct, decrementProduct, navigation, user, triggerAuthPrompt]
  );

  const renderHeader = useMemo(
    () => (
      <View style={styles.headerSection}>
        {/* TOP BAR WITH BACK AND ACTIONS */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back to home"
          >
            <Ionicons name="arrow-back" size={22} color={colors.navy} />
          </TouchableOpacity>

          <View style={styles.topBarTitleWrap}>
            <Text style={styles.screenTitle}>Wholesale Catalog</Text>
            <Text style={styles.screenSubtitle}>Commercial wholesale products & bulk rates</Text>
          </View>

          <View style={styles.topActions}>
            {user ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Wishlist')}
                hitSlop={6}
                accessibilityLabel="Open wishlist"
              >
                <Ionicons name="heart-outline" size={20} color={colors.text} />
                {wishlistItems.length > 0 && (
                  <View style={styles.iconBadge}>
                    <Text style={styles.iconBadgeText}>{wishlistItems.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}

            {user ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Cart')}
                hitSlop={6}
                accessibilityLabel="Open cart"
              >
                <Ionicons name="cart-outline" size={20} color={colors.text} />
                {totalCartItems > 0 && (
                  <View style={styles.iconBadge}>
                    <Text style={styles.iconBadgeText}>{totalCartItems}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchContainer}>
          <View style={styles.searchField}>
            <Ionicons name="search" size={18} color={colors.primary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search eggs, beverages, wholesale supplies..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={(text) => setSearch(text)}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {search.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={6}
              >
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* CATEGORY TABS */}
        <View style={styles.categorySection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              const isThisCategoryLoading = isSelected && isCategoryLoading;
              const count = getCategoryCount(cat.id);

              return (
                <TouchableOpacity
                  key={cat.id || 'all'}
                  activeOpacity={0.8}
                  onPress={() => handleSelectCategory(cat.id)}
                  style={[styles.categoryTab, isSelected && styles.categoryTabActive]}
                >
                  {isThisCategoryLoading ? (
                    <View style={styles.tabLoader}>
                      <ActivityIndicator size="small" color={colors.white} />
                    </View>
                  ) : (
                    <MaterialCommunityIcons
                      name={cat.icon as any}
                      size={18}
                      color={isSelected ? colors.white : colors.primary}
                    />
                  )}
                  <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextActive]}>
                    {cat.label}
                  </Text>
                  {count != null && count > 0 ? (
                    <View style={[styles.categoryCountBadge, isSelected && styles.categoryCountBadgeActive]}>
                      <Text style={[styles.categoryCountText, isSelected && styles.categoryCountTextActive]}>
                        {count}
                      </Text>
                    </View>
                  ) : null}
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
            <View style={styles.chipInnerRow}>
              <Feather
                name="star"
                size={12}
                color={selectedFilter === 'featured' ? colors.white : colors.primary}
              />
              <Text style={[styles.filterChipText, selectedFilter === 'featured' && styles.filterChipTextActive]}>
                Featured
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSelectFilter('bestseller')}
            style={[styles.filterChip, selectedFilter === 'bestseller' && styles.filterChipActive]}
          >
            <View style={styles.chipInnerRow}>
              <Feather
                name="trending-up"
                size={12}
                color={selectedFilter === 'bestseller' ? colors.white : colors.primary}
              />
              <Text style={[styles.filterChipText, selectedFilter === 'bestseller' && styles.filterChipTextActive]}>
                Bestsellers
              </Text>
            </View>
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
            {search
              ? `Results for "${search}"`
              : category
              ? `${category} Catalog`
              : selectedFilter !== 'all'
              ? `${selectedFilter.toUpperCase()} Products`
              : 'All Available Products'}
          </Text>
          <Text style={styles.catalogCount}>
            {isCategoryLoading ? 'Loading products…' : `${items.length} item${items.length === 1 ? '' : 's'} found`}
          </Text>
        </View>
      </View>
    ),
    [
      navigation,
      user,
      wishlistItems.length,
      totalCartItems,
      search,
      category,
      selectedFilter,
      isCategoryLoading,
      items.length,
      backendCategories,
      getCategoryCount,
      handleSelectCategory,
      handleSelectFilter
    ]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={isCategoryLoading ? [] : items}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={8}
        initialNumToRender={6}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          isCategoryLoading || (loading && items.length === 0) ? (
            <View style={styles.skeletonGrid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.productCell}>
                  <ProductCardSkeleton compact />
                </View>
              ))}
            </View>
          ) : error ? (
            <ErrorView
              message={error}
              onRetry={() => executeProductFetch(category, search, selectedFilter, 1, true)}
            />
          ) : (
            <EmptyState
              title="No Products Found"
              description="No commercial products matched your search or category filter. Try clearing filters or searching for another term."
              actionLabel="View All Products"
              onAction={() => {
                setCategory('');
                setSearch('');
                setSelectedFilter('all');
                executeProductFetch('', '', 'all', 1, true);
              }}
            />
          )
        }
        renderItem={renderProductItem}
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.footerLoaderText}>Loading more wholesale supplies...</Text>
            </View>
          ) : page >= totalPages && items.length > 0 ? (
            <View style={styles.endOfResults}>
              <View style={styles.endOfResultsLine} />
              <Text style={styles.endOfResultsText}>End of Catalog</Text>
              <View style={styles.endOfResultsLine} />
            </View>
          ) : null
        }
      />

      {/* FLOATING CART BUTTON FOR BUYERS */}
      {user && totalCartItems > 0 && (
        <Animated.View
          style={[
            styles.floatingCartWrap,
            { bottom: Math.max(16, insets.bottom + 8), transform: [{ scale: cartScale }] }
          ]}
        >
          <TouchableOpacity
            style={styles.floatingCartBtn}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.92}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.cartBadgeCircle}>
                <Text style={styles.cartBadgeCircleText}>{totalCartItems}</Text>
              </View>
              <Text style={styles.floatingCartTitle}>Items in Cart</Text>
            </View>
            <View style={styles.floatingCartRight}>
              <Text style={styles.floatingCartAction}>View Cart</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.white} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* AUTH PROMPT MODAL FOR GUEST COMMERCE ACTIONS */}
      <AuthPromptModal
        visible={authModalVisible}
        action={authModalAction}
        product={authModalProduct}
        quantity={authModalQuantity}
        onClose={() => setAuthModalVisible(false)}
        onSignIn={handleAuthModalSignIn}
        onSignUp={handleAuthModalSignUp}
      />
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
    paddingBottom: 90
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12
  },
  productCell: {
    width: '48.2%'
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  headerSection: {
    marginBottom: 10
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm
  },
  topBarTitleWrap: {
    flex: 1
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: -0.2
  },
  screenSubtitle: {
    fontSize: 11.5,
    color: colors.textSecondary
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative'
  },
  iconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  iconBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900'
  },
  searchContainer: {
    marginBottom: 10
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    gap: 8,
    ...shadows.sm
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.text,
    paddingVertical: 8
  },
  categorySection: {
    marginBottom: 8
  },
  categoryScroll: {
    gap: 8
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm
  },
  tabLoader: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 0.8 }]
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text
  },
  categoryTabTextActive: {
    color: colors.white
  },
  categoryCountBadge: {
    backgroundColor: colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  categoryCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.4)'
  },
  categoryCountText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.textSecondary
  },
  categoryCountTextActive: {
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
  chipInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
    paddingHorizontal: 2
  },
  catalogHeading: {
    fontSize: 15.5,
    fontWeight: '900',
    color: colors.navy
  },
  catalogCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20
  },
  footerLoaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary
  },
  endOfResults: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24
  },
  endOfResultsLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border
  },
  endOfResultsText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  floatingCartWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99
  },
  floatingCartBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
    ...shadows.floating
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  cartBadgeCircle: {
    backgroundColor: colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cartBadgeCircleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900'
  },
  floatingCartTitle: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '800'
  },
  floatingCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  floatingCartAction: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700'
  }
});
