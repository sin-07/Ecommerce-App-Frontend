import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  FlatList,
  Image,
  LayoutAnimation,
  PanResponder,
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
import { AuthPromptAction, AuthPromptModal } from '../components/AuthPromptModal';
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
import { logout, setPendingAction } from '../redux/slices/authSlice';
import { addCartItem, fetchCart, removeCartItem, updateCartItem } from '../redux/slices/cartSlice';
import { clearProducts, fetchProducts, fetchCategories, setCachedProducts } from '../redux/slices/productSlice';
import { loadWishlist } from '../redux/slices/wishlistSlice';
import { toast } from '../utils/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.82);

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

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
        delay: Math.min(index, 6) * 30,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        delay: Math.min(index, 6) * 30,
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
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [developerNoteVisible, setDeveloperNoteVisible] = useState(false);

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

  // Drawer animation state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cartScale = useRef(new Animated.Value(1)).current;
  const isClosingRef = useRef(false);

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

      // If cached and not forced refresh, immediately display cached items without waiting
      if (!forceRefresh && categoryCacheRef.current[cacheKey]) {
        const cached = categoryCacheRef.current[cacheKey];
        dispatch(setCachedProducts({ items: cached.items, page: cached.page, totalPages: cached.totalPages }));
        setIsCategoryLoading(false);
        return;
      }

      // If cache miss, activate immediate loading state
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

        // Check for race condition: only update if this is still the latest user request
        if (reqId === latestRequestId.current) {
          if (res?.data && res?.pagination) {
            categoryCacheRef.current[cacheKey] = {
              items: res.data,
              page: res.pagination.page,
              totalPages: res.pagination.totalPages
            };
          }
        }
      } catch (fetchErr) {
        // Handled via Redux error state
      } finally {
        if (reqId === latestRequestId.current) {
          setIsCategoryLoading(false);
        }
      }
    },
    [dispatch]
  );

  // Sync route params if category passed from drawer
  useEffect(() => {
    if (route.params?.initialCategory !== undefined) {
      setCategory(route.params.initialCategory);
    }
  }, [route.params?.initialCategory]);

  // Initial load
  useEffect(() => {
    executeProductFetch(category, search, selectedFilter, 1);
    dispatch(fetchCategories());
    dispatch(fetchCart());
    dispatch(loadWishlist());
  }, [dispatch]);

  // Smooth "Lazy" Drawer Open Animation
  const openDrawer = useCallback(() => {
    isClosingRef.current = false;
    setDrawerOpen(true);
    drawerAnim.setValue(-DRAWER_WIDTH);
    overlayAnim.setValue(0);
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }, [drawerAnim, overlayAnim]);

  // Smooth "Lazy" Drawer Close Animation
  const closeDrawer = useCallback(
    (callback?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      Animated.parallel([
        Animated.timing(drawerAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        isClosingRef.current = false;
        if (finished) {
          setDrawerOpen(false);
          if (callback) callback();
        }
      });
    },
    [drawerAnim, overlayAnim]
  );

  // Android Back Button listener: smoothly closes drawer first if open
  useEffect(() => {
    if (!drawerOpen) return;
    const backAction = () => {
      closeDrawer();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [drawerOpen, closeDrawer]);

  // Gesture PanResponder for swiping drawer to close
  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dx < -10 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dx < 0) {
            drawerAnim.setValue(gestureState.dx);
            const progress = Math.max(0, 1 + gestureState.dx / DRAWER_WIDTH);
            overlayAnim.setValue(progress);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -60 || gestureState.vx < -0.5) {
            closeDrawer();
          } else {
            Animated.parallel([
              Animated.spring(drawerAnim, {
                toValue: 0,
                friction: 6,
                tension: 40,
                useNativeDriver: true
              }),
              Animated.timing(overlayAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true
              })
            ]).start();
          }
        }
      }),
    [closeDrawer, drawerAnim, overlayAnim]
  );

  // Edge Swipe PanResponder on screen container for opening from left edge
  const edgePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return !drawerOpen && gestureState.x0 < 28 && gestureState.dx > 18 && Math.abs(gestureState.dy) < 30;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 25) {
            openDrawer();
          }
        }
      }),
    [drawerOpen, openDrawer]
  );

  // Debounced search effect
  useEffect(() => {
    if (!search.trim()) return;
    const timer = setTimeout(() => {
      executeProductFetch(category, search, selectedFilter, 1);
    }, 260);
    return () => clearTimeout(timer);
  }, [search, category, selectedFilter, executeProductFetch]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Invalidate cache on manual pull-to-refresh
    categoryCacheRef.current = {};
    await executeProductFetch(category, search, selectedFilter, 1, true);
    await dispatch(fetchCart());
    await dispatch(loadWishlist());
    setIsRefreshing(false);
  }, [category, search, selectedFilter, executeProductFetch, dispatch]);

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
      if (target && target.stock <= 0) {
        toast.error('This product is currently out of stock.');
        return;
      }
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

  // Immediate category tab selection with instant feedback and loading state
  const handleSelectCategory = useCallback(
    (catId: string) => {
      if (catId === category) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCategory(catId);
      executeProductFetch(catId, search, selectedFilter, 1);
    },
    [category, search, selectedFilter, executeProductFetch]
  );

  // Immediate sort filter selection
  const handleSelectFilter = useCallback(
    (filter: 'all' | 'featured' | 'bestseller' | 'price_low' | 'price_high') => {
      if (filter === selectedFilter) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedFilter(filter);
      executeProductFetch(category, search, filter, 1);
    },
    [selectedFilter, category, search, executeProductFetch]
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
              {user ? `Hello, ${user.name?.split(' ')[0] || 'Wholesale Buyer'}` : 'Browse Wholesale Catalog'}
            </Text>
          </View>
          <View style={styles.topActionBtns}>
            {user ? (
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
            ) : null}

            <TouchableOpacity
              style={styles.iconButton}
              onPress={drawerOpen ? () => closeDrawer() : openDrawer}
              hitSlop={6}
              accessibilityLabel="Open sidebar menu"
            >
              <MaterialCommunityIcons
                name={drawerOpen ? 'close' : 'menu'}
                size={22}
                color={colors.text}
              />
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
              onChangeText={(text) => {
                setSearch(text);
                if (text === '') {
                  executeProductFetch(category, '', selectedFilter, 1);
                }
              }}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {search.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  executeProductFetch(category, '', selectedFilter, 1);
                }}
                hitSlop={6}
              >
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* HERO / PROMO BANNER CAROUSEL (REMAINS 100% STABLE & MOUNTED) */}
        {!search && (
          <PromoBannerCarousel onSelectCategory={handleSelectCategory} />
        )}

        {/* CATEGORY TABS */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionHeading}>Product Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              const isThisCategoryLoading = isSelected && isCategoryLoading;

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
            {category ? `${category} Catalog` : 'Wholesale Catalog'}
          </Text>
          <Text style={styles.catalogCount}>
            {isCategoryLoading ? 'Loading products…' : `${items.length} item${items.length === 1 ? '' : 's'} available`}
          </Text>
        </View>
      </View>
    ),
    [
      user?.name,
      wishlistItems.length,
      search,
      category,
      selectedFilter,
      isCategoryLoading,
      items.length,
      drawerOpen,
      handleSelectCategory,
      handleSelectFilter,
      executeProductFetch,
      openDrawer,
      closeDrawer
    ]
  );

  return (
    <SafeAreaView style={styles.container} {...edgePanResponder.panHandlers}>
      <FlatList
        data={isCategoryLoading ? [] : items}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          isCategoryLoading || (loading && items.length === 0) ? (
            <View style={styles.skeletonGrid}>
              {[1, 2, 3, 4].map((i) => (
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
              description="No wholesale beverages or egg supplies matched your search/filter criteria."
              actionLabel="Reset Filters"
              onAction={() => {
                setSearch('');
                setCategory('');
                setSelectedFilter('all');
                executeProductFetch('', '', 'all', 1);
              }}
            />
          )
        }
        ListFooterComponent={
          !isCategoryLoading && items.length > 0 && totalPages > 1 ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                onPress={() => {
                  if (page > 1) {
                    executeProductFetch(category, search, selectedFilter, page - 1);
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
            {...drawerPanResponder.panHandlers}
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
              {/* GUEST WELCOME CARD */}
              {!user ? (
                <View style={styles.drawerGuestCard}>
                  <Text style={styles.drawerGuestTitle}>Wholesale Trade Access</Text>
                  <Text style={styles.drawerGuestSubtitle}>
                    Sign in to unlock wholesale case pricing, place bulk orders, and dispatch deliveries.
                  </Text>
                  <View style={styles.drawerGuestButtons}>
                    <TouchableOpacity
                      style={styles.drawerSignInBtn}
                      activeOpacity={0.88}
                      onPress={() => closeDrawer(() => navigation.navigate('Login'))}
                    >
                      <MaterialCommunityIcons name="login" size={16} color={colors.white} />
                      <Text style={styles.drawerSignInBtnText}>Sign In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.drawerSignUpBtn}
                      activeOpacity={0.88}
                      onPress={() => closeDrawer(() => navigation.navigate('Register'))}
                    >
                      <MaterialCommunityIcons name="account-plus-outline" size={16} color={colors.primary} />
                      <Text style={styles.drawerSignUpBtnText}>Create Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* NAVIGATION MENU ITEMS */}
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => {
                  setCategory('');
                  setSelectedFilter('all');
                  executeProductFetch('', search, 'all', 1);
                })}
              >
                <Ionicons name="home-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Home & All Products</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => {
                  setCategory('Eggs');
                  executeProductFetch('Eggs', search, selectedFilter, 1);
                })}
              >
                <MaterialCommunityIcons name="egg-outline" size={20} color="#D97706" />
                <Text style={styles.drawerItemText}>Farm Fresh Eggs</Text>
                <View style={[styles.drawerBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.drawerBadgeText, { color: '#92400E' }]}>Trays & Crates</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => {
                  setCategory('Beverages');
                  executeProductFetch('Beverages', search, selectedFilter, 1);
                })}
              >
                <MaterialCommunityIcons name="cup-water" size={20} color="#0284C7" />
                <Text style={styles.drawerItemText}>Chilled Beverages</Text>
                <View style={[styles.drawerBadge, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={[styles.drawerBadgeText, { color: '#0369A1' }]}>Bulk Cans</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => {
                  setCategory('Existing Products');
                  executeProductFetch('Existing Products', search, selectedFilter, 1);
                })}
              >
                <MaterialCommunityIcons name="cube-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Wholesale Supplies</Text>
              </TouchableOpacity>

              <View style={styles.drawerDivider} />

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => {
                  if (!user) {
                    triggerAuthPrompt('wishlist');
                  } else {
                    navigation.navigate('Wishlist');
                  }
                })}
              >
                <Ionicons name="heart-outline" size={20} color="#EF4444" />
                <Text style={styles.drawerItemText}>My Wishlist</Text>
                {user && wishlistItems.length > 0 && (
                  <View style={[styles.drawerBadge, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.drawerBadgeText, { color: '#DC2626' }]}>{wishlistItems.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => {
                  if (!user) {
                    triggerAuthPrompt('cart');
                  } else {
                    navigation.navigate('Cart');
                  }
                })}
              >
                <Ionicons name="cart-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Shopping Cart</Text>
                {user && totalCartItems > 0 && (
                  <View style={styles.drawerBadge}>
                    <Text style={styles.drawerBadgeText}>{totalCartItems}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => closeDrawer(() => {
                  if (!user) {
                    triggerAuthPrompt('orders');
                  } else {
                    navigation.navigate('Orders');
                  }
                })}
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

              {user ? (
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
              ) : null}
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
        accessibilityLabel={`Open shopping cart`}
        onPress={() => {
          if (!user) {
            triggerAuthPrompt('cart');
          } else {
            navigation.navigate('Cart');
          }
        }}
        style={[styles.floatingCart, { bottom: Math.max(16, insets.bottom + 12) }]}
      >
        <Ionicons name="cart" size={20} color={colors.white} />
        <Text style={styles.floatingCartText}>Cart</Text>
        {user && totalCartItems > 0 ? (
          <Animated.View style={[styles.cartBadge, { transform: [{ scale: cartScale }] }]}>
            <Text style={styles.cartBadgeText}>{totalCartItems}</Text>
          </Animated.View>
        ) : null}
      </TouchableOpacity>

      {/* AUTH PROMPT MODAL FOR GUESTS */}
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
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
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
    fontSize: 18,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: 0.2
  },
  b2bBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#BBF7D0'
  },
  b2bBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.4
  },
  greeting: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 1,
    fontWeight: '600'
  },
  topActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconButton: {
    width: 40,
    height: 40,
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
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  tabLoader: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 0.8 }]
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
    fontWeight: '900'
  },
  catalogHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4
  },
  catalogHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.navy
  },
  catalogCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    marginTop: 8
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
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
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.textSecondary
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.52)'
  },
  drawerPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 16,
    ...shadows.modal
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12
  },
  drawerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  drawerLogo: {
    width: 38,
    height: 38,
    borderRadius: radius.md
  },
  drawerTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '900'
  },
  drawerSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  drawerScroll: {
    gap: 6,
    paddingBottom: 24
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.md
  },
  drawerItemText: {
    flex: 1,
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '700'
  },
  drawerBadge: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  drawerBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800'
  },
  drawerGuestCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 8
  },
  drawerGuestTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.navy
  },
  drawerGuestSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary
  },
  drawerGuestButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  drawerSignInBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  drawerSignInBtnText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: '700'
  },
  drawerSignUpBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  drawerSignUpBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  drawerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6
  },
  drawerLogout: {
    marginTop: 6
  },
  floatingCart: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    ...shadows.floating
  },
  floatingCartText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900'
  },
  cartBadge: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  cartBadgeText: {
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: '900'
  }
});
