import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { toggleWishlist, clearWishlist } from '../redux/slices/wishlistSlice';
import { addCartItem } from '../redux/slices/cartSlice';
import { Product } from '../constants/types';
import { API_BASE_URL } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { formatINR } from '../utils/currency';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Wishlist'>;

export const WishlistScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { items } = useAppSelector((state) => state.wishlist);

  const handleRemove = useCallback(
    (product: Product) => {
      dispatch(toggleWishlist(product));
      toast.info(`Removed ${product.name} from wishlist`);
    },
    [dispatch]
  );

  const handleAddToCart = useCallback(
    async (product: Product) => {
      const step = Math.max(1, product.minOrderQuantity || 1);
      try {
        await dispatch(addCartItem({ productId: product._id, quantity: step })).unwrap();
        toast.success(`Added ${step} ${product.unit || 'unit'}(s) to cart.`);
      } catch (err: any) {
        toast.error(err || 'Failed to add to cart');
      }
    },
    [dispatch]
  );

  const renderItem = useCallback(
    ({ item }: { item: Product }) => {
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
          </Pressable>

          <View style={styles.details}>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryBadge}>{item.category || 'General'}</Text>
              {item.packSize ? <Text style={styles.packSize}>{item.packSize}</Text> : null}
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
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.addToCartBtn}
                onPress={() => handleAddToCart(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="cart-outline" size={16} color={colors.white} />
                <Text style={styles.addToCartText}>Add to Cart</Text>
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
    [navigation, handleAddToCart, handleRemove]
  );

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
          <Text style={styles.headerSubtitle}>{items.length} saved product{items.length === 1 ? '' : 's'}</Text>
        </View>
        {items.length > 0 ? (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              dispatch(clearWishlist());
              toast.info('Wishlist cleared');
            }}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {items.length === 0 ? (
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
    overflow: 'hidden'
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
    gap: 2
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
