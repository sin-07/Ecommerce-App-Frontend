import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Image,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../constants/api';
import { AuthPromptAction, AuthPromptModal } from '../components/AuthPromptModal';
import { CategoryShopCards } from '../components/CategoryShopCards';
import { DeveloperNoteModal } from '../components/DeveloperNoteModal';
import { HorizontalProductSection } from '../components/HorizontalProductSection';
import { PromoBannerCarousel } from '../components/PromoBannerCarousel';
import { ProductCardSkeleton } from '../components/ProductCardSkeleton';
import { WholesaleCTACard } from '../components/WholesaleCTACard';
import { WhyChooseUsSection } from '../components/WhyChooseUsSection';
import { API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { BuyAgainProduct, PersonalizedRecommendationsResponse, Product } from '../constants/types';
import { useNetwork } from '../contexts/NetworkContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { logout, setPendingAction } from '../redux/slices/authSlice';
import { addCartItem, fetchCart, removeCartItem, updateCartItem } from '../redux/slices/cartSlice';
import { fetchUnreadCount, clearNotifications } from '../redux/slices/notificationSlice';
import { loadWishlist } from '../redux/slices/wishlistSlice';
import { formatINR } from '../utils/currency';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

const logoSource = require('../../assets/Ap-Enterprises.jpeg');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.82);

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { isOnline, setHasCachedData } = useNetwork();
  const { user } = useAppSelector((state) => state.auth);
  const { items: cartItems } = useAppSelector((state) => state.cart);
  const { items: wishlistItems } = useAppSelector((state) => state.wishlist);
  const { unreadCount } = useAppSelector((state) => state.notifications);

  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingStorefront, setLoadingStorefront] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [developerNoteVisible, setDeveloperNoteVisible] = useState(false);

  // Storefront Product Preview Lists (2–4 items each from real backend)
  const [eggProducts, setEggProducts] = useState<Product[]>([]);
  const [beverageProducts, setBeverageProducts] = useState<Product[]>([]);
  const [wholesaleProducts, setWholesaleProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [buyAgainProducts, setBuyAgainProducts] = useState<BuyAgainProduct[]>([]);
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendationsResponse | null>(null);
  const [buyAgainLoadingId, setBuyAgainLoadingId] = useState<string | null>(null);

  // Auth Prompt Modal State for Guest Users
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalAction, setAuthModalAction] = useState<AuthPromptAction>('general');
  const [authModalProduct, setAuthModalProduct] = useState<Product | null>(null);
  const [authModalQuantity, setAuthModalQuantity] = useState(1);

  // Drawer Animation State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const staggerAnim = useRef(new Animated.Value(0)).current;
  const cartScale = useRef(new Animated.Value(1)).current;
  const isClosingRef = useRef(false);

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

  // Fetch Storefront Curated Sections & Real Buyer History & Recommendations
  const fetchStorefrontData = useCallback(async () => {
    try {
      const [eggRes, bevRes, wholeRes, featRes, popRes, recRes] = await Promise.all([
        api.get('/products', { params: { category: 'Eggs', limit: 4 } }),
        api.get('/products', { params: { category: 'Beverages', limit: 4 } }),
        api.get('/products', { params: { category: 'Existing Products', limit: 4 } }),
        api.get('/products', { params: { isFeatured: true, limit: 4 } }),
        api.get('/products', { params: { isBestSeller: true, limit: 4 } }),
        api.get('/products/recommendations/personalized').catch(() => ({ data: { data: null } }))
      ]);

      if (eggRes.data?.data) setEggProducts(eggRes.data.data);
      if (bevRes.data?.data) setBeverageProducts(bevRes.data.data);
      if (wholeRes.data?.data) setWholesaleProducts(wholeRes.data.data);
      if (featRes.data?.data) setFeaturedProducts(featRes.data.data);
      if (popRes.data?.data) setPopularProducts(popRes.data.data);
      if (recRes?.data?.data) setRecommendations(recRes.data.data);

      setHasCachedData(Boolean(
        eggRes.data?.data?.length || bevRes.data?.data?.length || featRes.data?.data?.length
      ));

      if (user) {
        api.get('/orders/buyer/buy-again').then((res) => {
          if (res.data?.data) setBuyAgainProducts(res.data.data);
        }).catch(() => {});
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingStorefront(false);
    }
  }, [user, setHasCachedData]);

  // Synchronize unread notifications count whenever HomeScreen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) {
        dispatch(fetchUnreadCount());
      } else {
        dispatch(clearNotifications());
      }
    }, [dispatch, user])
  );

  // Initial load
  useEffect(() => {
    fetchStorefrontData();
    if (user) {
      dispatch(fetchCart());
      dispatch(loadWishlist());
      dispatch(fetchUnreadCount());
    }
  }, [dispatch, user, fetchStorefrontData]);

  const onRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchStorefrontData(),
        user ? dispatch(fetchCart()) : Promise.resolve(),
        user ? dispatch(loadWishlist()) : Promise.resolve()
      ]);
    } catch {
      toast.error('Could not refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, fetchStorefrontData, dispatch, user]);

  // Smooth "Lazy" Drawer Open Animation
  const openDrawer = useCallback(() => {
    isClosingRef.current = false;
    setIsDrawerMounted(true);
    setDrawerOpen(true);
    drawerAnim.setValue(-DRAWER_WIDTH);
    overlayAnim.setValue(0);
    staggerAnim.setValue(0);

    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 340,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(staggerAnim, {
        toValue: 1,
        duration: 420,
        delay: 50,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [drawerAnim, overlayAnim, staggerAnim]);

  // Smooth "Lazy" Drawer Close Animation
  const closeDrawer = useCallback(
    (callback?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      setDrawerOpen(false);

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
        }),
        Animated.timing(staggerAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        isClosingRef.current = false;
        if (finished) {
          setIsDrawerMounted(false);
          if (callback) callback();
        }
      });
    },
    [drawerAnim, overlayAnim, staggerAnim]
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
              Animated.timing(drawerAnim, {
                toValue: 0,
                duration: 180,
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

  const allKnownProducts = useMemo(() => {
    const map = new Map<string, Product>();
    [...eggProducts, ...beverageProducts, ...wholesaleProducts, ...featuredProducts, ...popularProducts].forEach(
      (p) => {
        if (p?._id) map.set(p._id, p);
      }
    );
    return map;
  }, [eggProducts, beverageProducts, wholesaleProducts, featuredProducts, popularProducts]);

  const incrementProduct = useCallback(
    async (productId: string, minOrderQuantity: number) => {
      const target = allKnownProducts.get(productId);

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
    [dispatch, allKnownProducts, getCartQuantityForProduct, user, triggerAuthPrompt]
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

  const handleBuyAgain = useCallback(
    async (item: BuyAgainProduct) => {
      if (!user) {
        haptics.lightImpact();
        triggerAuthPrompt('cart', item, item.previousQuantity);
        return;
      }

      if (item.stock <= 0) {
        haptics.errorNotification();
        toast.error('Product is no longer available.');
        return;
      }

      const moq = Math.max(1, item.minOrderQuantity || 1);
      const targetQty = Math.max(moq, Math.min(item.previousQuantity || 1, item.stock));

      if (item.previousQuantity > item.stock) {
        toast.info(`Only ${item.stock} ${item.unit || 'unit'}(s) currently available.`);
      }

      haptics.mediumImpact();
      setBuyAgainLoadingId(item._id);
      try {
        await dispatch(addCartItem({ productId: item._id, quantity: targetQty })).unwrap();
        toast.success(`Reordered ${targetQty} ${item.unit || 'unit'}(s) of ${item.name}!`);
      } catch (err: any) {
        haptics.errorNotification();
        toast.error(err || 'Failed to reorder product');
      } finally {
        setBuyAgainLoadingId(null);
      }
    },
    [dispatch, user, triggerAuthPrompt]
  );

  const handleSearchSubmit = useCallback(() => {
    const query = searchQuery.trim();
    setSearchQuery('');
    navigation.navigate('Catalog', { initialSearch: query });
  }, [searchQuery, navigation]);

  const handleNavigateToCategory = useCallback((categoryName: string) => {
    navigation.navigate('Catalog', { initialCategory: categoryName });
  }, [navigation]);

  const handleNavigateToFeatured = useCallback(() => {
    navigation.navigate('Catalog', { initialFilter: 'featured' });
  }, [navigation]);

  const handleNavigateToCatalog = useCallback(() => {
    navigation.navigate('Catalog', {});
  }, [navigation]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await dispatch(logout()).unwrap();
      dispatch(clearNotifications());
      toast.info('Signed out of trade account.');
      closeDrawer();
    } catch {
      toast.error('Sign out failed');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* STICKY TOP CONTAINER: BRAND HEADER + SEARCH BAR */}
      <View style={styles.stickyTopBar}>
        {/* 1. BRAND & USER HEADER */}
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
              {user ? `Hello, ${user.name?.split(' ')[0] || 'Wholesale Buyer'}` : 'B2B Wholesale Supply'}
            </Text>
          </View>

          <View style={styles.topActionBtns}>
            {user ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Notifications')}
                hitSlop={6}
                accessibilityLabel="Open notifications"
              >
                <Ionicons name="notifications-outline" size={21} color={colors.text} />
                {unreadCount > 0 && (
                  <View style={styles.iconBadge}>
                    <Text style={styles.iconBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}

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
              <MaterialCommunityIcons name={drawerOpen ? 'close' : 'menu'} size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. STICKY SEARCH BAR */}
        <View style={styles.searchContainer}>
          <View style={styles.searchField}>
            <Ionicons name="search" size={19} color={colors.primary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search eggs, beverages, wholesale supplies..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={(text) => setSearchQuery(text)}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleSearchSubmit} hitSlop={6} style={styles.searchGoBtn}>
                <Text style={styles.searchGoText}>Search</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* SCROLLABLE STOREFRONT CONTENT */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* 3. PREMIUM HERO CAROUSEL */}
        <PromoBannerCarousel onSelectCategory={handleNavigateToCategory} />

        {/* 4. SMART "BUY AGAIN" / REORDER SECTION (Only for buyers with real purchase history) */}
        {user && buyAgainProducts.length > 0 ? (
          <View style={styles.buyAgainSection}>
            <View style={styles.buyAgainHeaderRow}>
              <View style={styles.buyAgainHeaderLeft}>
                <View style={styles.buyAgainIconCircle}>
                  <MaterialCommunityIcons name="refresh" size={18} color="#9333EA" />
                </View>
                <View>
                  <Text style={styles.buyAgainSectionTitle}>Buy Again</Text>
                  <Text style={styles.buyAgainSectionSubtitle}>Quickly reorder your regular supplies</Text>
                </View>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buyAgainScroll}>
              {buyAgainProducts.map((item) => {
                const isOutOfStock = item.stock <= 0;
                const isLowStock = item.stock > 0 && item.stock <= 10;
                const rawUrl = item.imageUrl ? String(item.imageUrl).trim() : '';
                const imageUri = rawUrl.startsWith('http')
                  ? rawUrl
                  : rawUrl
                  ? `${API_BASE_URL.replace('/api', '')}${rawUrl}`
                  : '';
                const isPending = buyAgainLoadingId === item._id;

                return (
                  <View key={`buy-again-${item._id}`} style={styles.buyAgainCard}>
                    <Pressable
                      onPress={() => navigation.navigate('ProductDetails', { productId: item._id, product: item })}
                      style={styles.buyAgainImgWrap}
                    >
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.buyAgainImg} resizeMode="cover" />
                      ) : (
                        <View style={styles.buyAgainImgFallback}>
                          <MaterialCommunityIcons
                            name={item.category?.toLowerCase().includes('egg') ? 'egg-outline' : 'cup-water'}
                            size={30}
                            color={colors.primary}
                          />
                        </View>
                      )}
                      <View style={styles.buyAgainOrderedPill}>
                        <Text style={styles.buyAgainOrderedText}>
                          Last: {item.previousQuantity} {item.unit || 'unit'}{item.previousQuantity > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.buyAgainBody}>
                      <Text style={styles.buyAgainName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.buyAgainPriceRow}>
                        <Text style={styles.buyAgainPrice}>{formatINR(item.price)}</Text>
                        <Text style={[styles.buyAgainStockText, isOutOfStock && styles.stockOutText]}>
                          {isOutOfStock ? 'Out of stock' : isLowStock ? `Only ${item.stock} left` : 'In stock'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.buyAgainBtn, (isOutOfStock || isPending) && styles.buyAgainBtnDisabled]}
                        disabled={isOutOfStock || isPending}
                        onPress={() => handleBuyAgain(item)}
                        activeOpacity={0.88}
                      >
                        {isPending ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <MaterialCommunityIcons name="refresh" size={14} color={colors.white} />
                            <Text style={styles.buyAgainBtnText}>Buy Again</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* 5. SHOP BY CATEGORY (3 LARGE CARDS) */}
        <CategoryShopCards onSelectCategory={handleNavigateToCategory} />

        {/* 6. SMART RECOMMENDATIONS — "Because you bought Eggs" or "Recommended for Your Business" */}
        {recommendations && recommendations.products && recommendations.products.length > 0 ? (
          <HorizontalProductSection
            title={recommendations.title}
            subtitle={
              recommendations.reasonCategory && recommendations.reasonCategory !== 'General'
                ? `Tailored supplies based on your ${recommendations.reasonCategory} orders`
                : 'Top wholesale picks curated for your business'
            }
            badgeLabel="SMART MATCH"
            badgeTone={{ text: '#7C3AED', bg: isDark ? '#2E1065' : '#F5F3FF', border: isDark ? '#6D28D9' : '#DDD6FE' }}
            icon="star-shooting-outline"
            items={recommendations.products}
            onViewProduct={(p) => navigation.navigate('ProductDetails', { productId: p._id, product: p })}
            onIncrementCart={(p) => incrementProduct(p._id, p.minOrderQuantity || 1)}
            onDecrementCart={(p) => decrementProduct(p._id)}
            getCartQuantity={getCartQuantityForProduct}
            onRequireAuth={(action, p, qty) =>
              triggerAuthPrompt(action === 'wishlist' ? 'wishlist' : 'cart', p, qty)
            }
            onSeeAll={handleNavigateToCatalog}
          />
        ) : null}

        {/* 7. CURATED BUSINESS SUPPLY PREVIEWS (2–4 ITEMS EACH) */}
        {loadingStorefront ? (
          <View style={styles.loadingSkeletonSection}>
            <View style={styles.skeletonTitle} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRow}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonCardWrapper}>
                  <ProductCardSkeleton compact />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <>
            {/* FARM FRESH EGGS PREVIEW */}
            {eggProducts.length > 0 ? (
              <HorizontalProductSection
                title="Farm Fresh Eggs"
                subtitle="Reliable egg supply for retailers, restaurants & businesses"
                badgeLabel="100% FRESH"
                badgeTone={{ text: '#D97706', bg: '#FEF3C7', border: '#FDE68A' }}
                icon="egg-outline"
                items={eggProducts}
                onViewProduct={(p) => navigation.navigate('ProductDetails', { productId: p._id, product: p })}
                onIncrementCart={(p) => incrementProduct(p._id, p.minOrderQuantity || 1)}
                onDecrementCart={(p) => decrementProduct(p._id)}
                getCartQuantity={getCartQuantityForProduct}
                onRequireAuth={(action, p, qty) =>
                  triggerAuthPrompt(action === 'wishlist' ? 'wishlist' : 'cart', p, qty)
                }
                onSeeAll={() => handleNavigateToCategory('Eggs')}
              />
            ) : null}

            {/* CHILLED BEVERAGES PREVIEW */}
            {beverageProducts.length > 0 ? (
              <HorizontalProductSection
                title="Chilled Beverages"
                subtitle="Bulk beverage supply for commercial buyers"
                badgeLabel="FACTORY DIRECT"
                badgeTone={{ text: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD' }}
                icon="cup-water"
                items={beverageProducts}
                onViewProduct={(p) => navigation.navigate('ProductDetails', { productId: p._id, product: p })}
                onIncrementCart={(p) => incrementProduct(p._id, p.minOrderQuantity || 1)}
                onDecrementCart={(p) => decrementProduct(p._id)}
                getCartQuantity={getCartQuantityForProduct}
                onRequireAuth={(action, p, qty) =>
                  triggerAuthPrompt(action === 'wishlist' ? 'wishlist' : 'cart', p, qty)
                }
                onSeeAll={() => handleNavigateToCategory('Beverages')}
              />
            ) : null}

            {/* WHOLESALE SUPPLIES PREVIEW */}
            {wholesaleProducts.length > 0 ? (
              <HorizontalProductSection
                title="Wholesale Supplies"
                subtitle="Commercial products for your business"
                badgeLabel="BULK STOCK"
                badgeTone={{ text: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' }}
                icon="cube-outline"
                items={wholesaleProducts}
                onViewProduct={(p) => navigation.navigate('ProductDetails', { productId: p._id, product: p })}
                onIncrementCart={(p) => incrementProduct(p._id, p.minOrderQuantity || 1)}
                onDecrementCart={(p) => decrementProduct(p._id)}
                getCartQuantity={getCartQuantityForProduct}
                onRequireAuth={(action, p, qty) =>
                  triggerAuthPrompt(action === 'wishlist' ? 'wishlist' : 'cart', p, qty)
                }
                onSeeAll={() => handleNavigateToCategory('Existing Products')}
              />
            ) : null}

            {/* FEATURED FOR BUSINESS PREVIEW */}
            {featuredProducts.length > 0 ? (
              <HorizontalProductSection
                title="Featured for Business"
                subtitle="High-demand commercial inventory with tiered pricing"
                badgeLabel="FEATURED"
                badgeTone={{ text: '#D97706', bg: '#FEF3C7', border: '#FDE68A' }}
                icon="star-outline"
                items={featuredProducts}
                onViewProduct={(p) => navigation.navigate('ProductDetails', { productId: p._id, product: p })}
                onIncrementCart={(p) => incrementProduct(p._id, p.minOrderQuantity || 1)}
                onDecrementCart={(p) => decrementProduct(p._id)}
                getCartQuantity={getCartQuantityForProduct}
                onRequireAuth={(action, p, qty) =>
                  triggerAuthPrompt(action === 'wishlist' ? 'wishlist' : 'cart', p, qty)
                }
                onSeeAll={handleNavigateToFeatured}
              />
            ) : null}

            {/* POPULAR WITH BUYERS PREVIEW */}
            {popularProducts.length > 0 ? (
              <HorizontalProductSection
                title="Popular with Buyers"
                subtitle="Top-reordered wholesale products across commercial accounts"
                badgeLabel="POPULAR"
                badgeTone={{ text: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' }}
                icon="trending-up"
                items={popularProducts}
                onViewProduct={(p) => navigation.navigate('ProductDetails', { productId: p._id, product: p })}
                onIncrementCart={(p) => incrementProduct(p._id, p.minOrderQuantity || 1)}
                onDecrementCart={(p) => decrementProduct(p._id)}
                getCartQuantity={getCartQuantityForProduct}
                onRequireAuth={(action, p, qty) =>
                  triggerAuthPrompt(action === 'wishlist' ? 'wishlist' : 'cart', p, qty)
                }
                onSeeAll={handleNavigateToCatalog}
              />
            ) : null}
          </>
        )}

        {/* 6. WHY BUSINESSES CHOOSE US */}
        <WhyChooseUsSection />

        {/* 7. WHOLESALE CTA CARD */}
        <WholesaleCTACard onPress={handleNavigateToCatalog} />

        {/* 8. COMPACT FOOTER */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerBrand}>AP ENTERPRISES</Text>
          <Text style={styles.footerTagline}>Direct B2B Wholesale Supply • Eggs • Beverages • Supplies</Text>
          <TouchableOpacity onPress={() => setDeveloperNoteVisible(true)} hitSlop={6}>
            <Text style={styles.developerNoteLink}>Developer Specifications</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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

      {/* SIDEBAR DRAWER OVERLAY */}
      {isDrawerMounted && (
        <Animated.View
          style={[
            styles.drawerOverlay,
            {
              opacity: overlayAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.48]
              })
            }
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDrawer()} />
        </Animated.View>
      )}

      {/* SIDEBAR DRAWER */}
      {isDrawerMounted && (
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              paddingTop: Math.max(16, insets.top + 8),
              paddingBottom: Math.max(16, insets.bottom + 8),
              transform: [{ translateX: drawerAnim }]
            }
          ]}
          {...drawerPanResponder.panHandlers}
        >
          {/* STAGGERED SECTION 1: HEADER & PROFILE / GUEST CARD */}
          <Animated.View
            style={{
              opacity: staggerAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] }),
              transform: [
                {
                  translateX: staggerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] })
                }
              ]
            }}
          >
            <View style={styles.drawerHeader}>
              <View style={styles.drawerLogoWrap}>
                <Image source={logoSource} style={styles.drawerLogo} resizeMode="cover" />
                <View style={styles.drawerTitleWrap}>
                  <Text style={styles.drawerTitle}>AP Enterprises</Text>
                  <Text style={styles.drawerSub}>B2B Commerce</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => closeDrawer()} hitSlop={8} style={styles.drawerCloseBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
            {/* PROFILE / GUEST ACCESS CARD */}
            <Animated.View
              style={{
                opacity: staggerAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] }),
                transform: [
                  {
                    translateX: staggerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] })
                  }
                ]
              }}
            >
              {user ? (
                <View style={styles.drawerUserCard}>
                  <View style={styles.drawerAvatar}>
                    <Text style={styles.drawerAvatarText}>
                      {(user.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.drawerUserInfo}>
                    <Text style={styles.drawerUserName} numberOfLines={1}>
                      {user.name}
                    </Text>
                    <Text style={styles.drawerUserEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                    <View style={styles.drawerRolePill}>
                      <Text style={styles.drawerRoleText}>WHOLESALE BUYER</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.drawerGuestCard}>
                  <View style={styles.drawerGuestIcon}>
                    <MaterialCommunityIcons name="shield-account" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.drawerGuestTextWrap}>
                    <Text style={styles.drawerGuestTitle}>Wholesale Trade Access</Text>
                    <Text style={styles.drawerGuestSub}>Sign in to place orders, view bulk discounts & reorder.</Text>
                  </View>
                  <View style={styles.drawerGuestActionRow}>
                    <TouchableOpacity
                      style={styles.drawerSignInBtn}
                      onPress={() => closeDrawer(() => navigation.navigate('Login'))}
                    >
                      <Text style={styles.drawerSignInBtnText}>Sign In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.drawerSignUpBtn}
                      onPress={() => closeDrawer(() => navigation.navigate('Register'))}
                    >
                      <Text style={styles.drawerSignUpBtnText}>Create Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Animated.View>

            <View style={styles.drawerDivider} />

            {/* STAGGERED SECTION 2: STOREFRONT & VERTICALS */}
            <Animated.View
              style={{
                opacity: staggerAnim.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 0, 0.7, 1] }),
                transform: [
                  {
                    translateX: staggerAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [-16, -16, 0] })
                  }
                ]
              }}
            >
              <View style={styles.drawerNavGroup}>
                <Text style={styles.drawerNavLabel}>STOREFRONT & VERTICALS</Text>

                <TouchableOpacity
                  style={[styles.drawerNavItem, styles.drawerNavItemActive]}
                  onPress={() => closeDrawer()}
                >
                  <MaterialCommunityIcons name="home-outline" size={20} color={colors.primary} />
                  <Text style={[styles.drawerNavText, styles.drawerNavTextActive]}>Storefront Home</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => closeDrawer(() => handleNavigateToCatalog())}
                >
                  <MaterialCommunityIcons name="storefront-outline" size={20} color={colors.text} />
                  <Text style={styles.drawerNavText}>All Wholesale Catalog</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => closeDrawer(() => handleNavigateToCategory('Eggs'))}
                >
                  <MaterialCommunityIcons name="egg-outline" size={20} color={colors.text} />
                  <Text style={styles.drawerNavText}>Farm Fresh Eggs</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => closeDrawer(() => handleNavigateToCategory('Beverages'))}
                >
                  <MaterialCommunityIcons name="cup-water" size={20} color={colors.text} />
                  <Text style={styles.drawerNavText}>Chilled Beverages</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => closeDrawer(() => handleNavigateToCategory('Existing Products'))}
                >
                  <MaterialCommunityIcons name="cube-outline" size={20} color={colors.text} />
                  <Text style={styles.drawerNavText}>Wholesale Supplies</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            <View style={styles.drawerDivider} />

            {/* STAGGERED SECTION 3: TRADE MANAGEMENT */}
            <Animated.View
              style={{
                opacity: staggerAnim.interpolate({ inputRange: [0, 0.4, 0.9, 1], outputRange: [0, 0, 0.8, 1] }),
                transform: [
                  {
                    translateX: staggerAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [-16, -16, 0] })
                  }
                ]
              }}
            >
              <View style={styles.drawerNavGroup}>
                <Text style={styles.drawerNavLabel}>TRADE MANAGEMENT</Text>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() =>
                    closeDrawer(() => {
                      if (!user) triggerAuthPrompt('general');
                      else navigation.navigate('Account');
                    })
                  }
                >
                  <MaterialCommunityIcons name="account-circle-outline" size={20} color={colors.primary} />
                  <Text style={[styles.drawerNavText, { color: colors.primary, fontWeight: '800' }]}>Account & Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() =>
                    closeDrawer(() => {
                      if (!user) triggerAuthPrompt('general');
                      else navigation.navigate('Notifications');
                    })
                  }
                >
                  <Ionicons name="notifications-outline" size={20} color={colors.text} />
                  <Text style={styles.drawerNavText}>Notification Center</Text>
                  {unreadCount > 0 && (
                    <View style={styles.drawerBadge}>
                      <Text style={styles.drawerBadgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() =>
                    closeDrawer(() => {
                      if (!user) triggerAuthPrompt('general');
                      else navigation.navigate('Orders');
                    })
                  }
                >
                  <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={colors.text} />
                  <Text style={styles.drawerNavText}>Commercial Orders</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() =>
                    closeDrawer(() => {
                      if (!user) triggerAuthPrompt('wishlist');
                      else navigation.navigate('Wishlist');
                    })
                  }
                >
                  <Ionicons name="heart-outline" size={20} color={colors.text} />
                  <Text style={styles.drawerNavText}>Wishlist</Text>
                  {wishlistItems.length > 0 && (
                    <View style={styles.drawerBadge}>
                      <Text style={styles.drawerBadgeText}>{wishlistItems.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() =>
                    closeDrawer(() => {
                      if (!user) triggerAuthPrompt('cart');
                      else navigation.navigate('Cart');
                    })
                  }
                >
                  <Ionicons name="cart-outline" size={20} color={colors.text} />
                  <Text style={styles.drawerNavText}>Wholesale Cart</Text>
                  {totalCartItems > 0 && (
                    <View style={styles.drawerBadge}>
                      <Text style={styles.drawerBadgeText}>{totalCartItems}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>

            {user?.role === 'admin' && (
              <>
                <View style={styles.drawerDivider} />
                <Animated.View
                  style={{
                    opacity: staggerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
                    transform: [
                      {
                        translateX: staggerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-16, -16, 0] })
                      }
                    ]
                  }}
                >
                  <View style={styles.drawerNavGroup}>
                    <Text style={styles.drawerNavLabel}>ADMINISTRATION</Text>
                    <TouchableOpacity
                      style={styles.drawerNavItem}
                      onPress={() => closeDrawer(() => navigation.navigate('AdminDashboard'))}
                    >
                      <MaterialCommunityIcons name="view-dashboard-outline" size={20} color={colors.citrus} />
                      <Text style={[styles.drawerNavText, { color: colors.citrus }]}>Admin Portal</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </>
            )}

            {/* STAGGERED SECTION 4: FOOTER / SIGN OUT */}
            {user ? (
              <>
                <View style={styles.drawerDivider} />
                <Animated.View
                  style={{
                    opacity: staggerAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
                    transform: [
                      {
                        translateX: staggerAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [-16, -16, 0] })
                      }
                    ]
                  }}
                >
                  <View style={styles.drawerFooterGroup}>
                    <TouchableOpacity
                      style={styles.drawerLogoutBtn}
                      onPress={handleLogout}
                      disabled={loggingOut}
                    >
                      {loggingOut ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="logout" size={18} color={colors.danger} />
                          <Text style={styles.drawerLogoutText}>Sign Out of Trade Account</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </>
            ) : (
              <View style={{ height: 16 }} />
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* AUTH PROMPT MODAL FOR GUEST USERS */}
      <AuthPromptModal
        visible={authModalVisible}
        action={authModalAction}
        product={authModalProduct}
        quantity={authModalQuantity}
        onClose={() => setAuthModalVisible(false)}
        onSignIn={handleAuthModalSignIn}
        onSignUp={handleAuthModalSignUp}
      />

      {/* DEVELOPER NOTE MODAL */}
      <DeveloperNoteModal visible={developerNoteVisible} onClose={() => setDeveloperNoteVisible(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  stickyTopBar: {
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 10
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
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
  searchGoBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm
  },
  searchGoText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary
  },
  loadingSkeletonSection: {
    marginVertical: 12,
    gap: 10
  },
  skeletonTitle: {
    width: 140,
    height: 18,
    borderRadius: radius.xs,
    backgroundColor: colors.borderLight
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12
  },
  skeletonCardWrapper: {
    width: 185
  },
  footerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 4
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: 0.8
  },
  footerTagline: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center'
  },
  developerNoteLink: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 6,
    textDecorationLine: 'underline'
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
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 100
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.card,
    zIndex: 101,
    ...shadows.modal
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  drawerLogoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  drawerLogo: {
    width: 36,
    height: 36,
    borderRadius: radius.sm
  },
  drawerTitleWrap: {
    gap: 1
  },
  drawerTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: colors.navy
  },
  drawerSub: {
    fontSize: 11,
    color: colors.textSecondary
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.bg
  },
  drawerScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  drawerUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  drawerAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  drawerAvatarText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900'
  },
  drawerUserInfo: {
    flex: 1,
    gap: 2
  },
  drawerUserName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.navy
  },
  drawerUserEmail: {
    fontSize: 11.5,
    color: colors.textSecondary
  },
  drawerRolePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 2
  },
  drawerRoleText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3
  },
  drawerGuestCard: {
    padding: 14,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10
  },
  drawerGuestIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  drawerGuestTextWrap: {
    gap: 2
  },
  drawerGuestTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.navy
  },
  drawerGuestSub: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary
  },
  drawerGuestActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2
  },
  drawerSignInBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  drawerSignInBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800'
  },
  drawerSignUpBtn: {
    flex: 1,
    backgroundColor: colors.card,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  drawerSignUpBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  drawerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14
  },
  drawerNavGroup: {
    gap: 4
  },
  drawerNavLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingLeft: 4
  },
  drawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md
  },
  drawerNavItemActive: {
    backgroundColor: colors.primaryLight
  },
  drawerNavText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text
  },
  drawerNavTextActive: {
    color: colors.primary,
    fontWeight: '800'
  },
  drawerBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill
  },
  drawerBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900'
  },
  drawerFooterGroup: {
    paddingBottom: 24
  },
  drawerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  drawerLogoutText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.danger
  },
  drawerLoginCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  drawerLoginCtaText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.primary
  },
  buyAgainSection: {
    marginVertical: 14,
    gap: 12
  },
  buyAgainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2
  },
  buyAgainHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  buyAgainIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buyAgainSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.navy
  },
  buyAgainSectionSubtitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1
  },
  buyAgainScroll: {
    gap: 12,
    paddingVertical: 2
  },
  buyAgainCard: {
    width: 190,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 8,
    ...shadows.card
  },
  buyAgainImgWrap: {
    height: 110,
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.cardAlt
  },
  buyAgainImg: {
    width: '100%',
    height: '100%'
  },
  buyAgainImgFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoSurface
  },
  buyAgainOrderedPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  buyAgainOrderedText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800'
  },
  buyAgainBody: {
    gap: 6
  },
  buyAgainName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  buyAgainPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  buyAgainPrice: {
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.navy
  },
  buyAgainStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success
  },
  stockOutText: {
    color: colors.danger
  },
  buyAgainBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  buyAgainBtnDisabled: {
    opacity: 0.5
  },
  buyAgainBtnText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '800'
  }
});
