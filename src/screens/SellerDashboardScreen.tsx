import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AppButton } from '../components/AppButton';
import { AppInput } from '../components/AppInput';
import { BeverageLoader } from '../components/BeverageLoader';
import { EditProductBottomSheet } from '../components/EditProductBottomSheet';
import { ProductCardSkeleton } from '../components/ProductCardSkeleton';
import { ProductCard } from '../components/ProductCard';
import { api } from '../constants/api';
import { Product } from '../constants/types';
import { colors, spacing, typeScale } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { logout } from '../redux/slices/authSlice';
import { fetchSellerProducts } from '../redux/slices/productSlice';
import { toast } from '../utils/toast';
import { getInventoryAnalytics, getStockLabel, getStockStatus } from '../utils/stock';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerDashboard'>;

// Beverage Categories for AP Enterprises
const CATEGORIES = ['Soft Drinks', 'Juices', 'Energy Drinks', 'Water & Soda', 'Tea & Coffee', 'Dairy Beverages'];

const FadeInCard: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 280,
      delay: Math.min(index, 6) * 60,
      useNativeDriver: true
    }).start();
  }, [index, opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
};

export const SellerDashboardScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const { sellerItems } = useAppSelector((state) => state.products);
  const { user } = useAppSelector((state) => state.auth);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minOrderQuantity, setMinOrderQuantity] = useState('1');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [activeSection, setActiveSection] = useState<'inventory' | 'marketplace'>('inventory');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [marketplaceItems, setMarketplaceItems] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Product[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [marketplaceCategory, setMarketplaceCategory] = useState('');
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);

  const scrollRef = React.useRef<ScrollView | null>(null);

  const categories = CATEGORIES;

  const loadMarketplace = useCallback(async (search = marketplaceSearch, category = marketplaceCategory) => {
    setMarketplaceLoading(true);
    try {
      const res = await api.get('/products', {
        params: { page: 1, limit: 12, search, category }
      });
      setMarketplaceItems(res.data.data || []);
    } finally {
      setMarketplaceLoading(false);
    }
  }, [marketplaceSearch, marketplaceCategory]);

  useEffect(() => {
    setInventoryLoading(true);
    if (user?.role === 'seller') {
      dispatch(fetchSellerProducts()).finally(() => setInventoryLoading(false));
    } else {
      setInventoryLoading(false);
    }
    loadMarketplace('', '');
  }, [dispatch, user?.role]);

  useEffect(() => {
    if (user?.role === 'admin') {
      setInventoryItems(marketplaceItems);
      setInventoryLoading(marketplaceLoading);
    } else {
      setInventoryItems(sellerItems);
    }
  }, [marketplaceItems, sellerItems, user?.role, marketplaceLoading]);

  // Refresh seller products on screen focus instead of polling every 25 s.
  // Eliminates background network/CPU usage when the user is on another screen.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.role === 'seller' && activeSection === 'inventory') {
        dispatch(fetchSellerProducts());
      }
    });
    return unsubscribe;
  }, [navigation, dispatch, user?.role, activeSection]);

  const inventoryAnalytics = useMemo(() => getInventoryAnalytics(inventoryItems), [inventoryItems]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to add product images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8
    });

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    setSelectedImage(asset);
    setImagePreviewUrl(asset.uri);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('');
    setPrice('');
    setStock('');
    setMinOrderQuantity('1');
    setSelectedImage(null);
    setImagePreviewUrl('');
  };

  const submitProduct = useCallback(async () => {
    setBusy(true);
    try {
      const payload = new FormData();
      payload.append('name', name);
      payload.append('description', description);
      payload.append('category', category);
      payload.append('price', String(Number(price)));
      payload.append('stock', String(Number(stock)));
      payload.append('minOrderQuantity', String(Number(minOrderQuantity)));

      if (selectedImage?.uri) {
        payload.append(
          'image',
          {
            uri: selectedImage.uri,
            name: selectedImage.fileName || `product-${Date.now()}.jpg`,
            type: selectedImage.mimeType || 'image/jpeg'
          } as any
        );
      }

      const res = await api.post('/products', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const created = res.data.data as Product;
      setInventoryItems((prev) => [created, ...prev]);
      toast.show('Product created.', 'success');

      resetForm();
      loadMarketplace();
    } catch (submitError: any) {
      toast.show(submitError?.response?.data?.message || 'Failed to save product', 'error');
    } finally {
      setBusy(false);
    }
  }, [name, description, category, price, stock, minOrderQuantity, selectedImage, loadMarketplace]);

  const deleteProduct = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await api.delete(`/products/${id}`);
      setInventoryItems((prev) => prev.filter((item) => item._id !== id));
      setMarketplaceItems((prev) => prev.filter((item) => item._id !== id));
      toast.show('Product deleted.', 'success');
    } catch (deleteError: any) {
      toast.show(deleteError?.response?.data?.message || 'Failed to delete product', 'error');
    } finally {
      setBusy(false);
    }
  }, []);

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setEditModalVisible(true);
    setActiveSection('inventory');
  };

  const saveEdit = useCallback(async (payload: { name: string; price: number; stock: number; category: string }) => {
    if (!editingProduct?._id) return;

    setEditSaving(true);
    try {
      const res = await api.put(`/products/${editingProduct._id}`, payload);
      const updated = res.data.data as Product;

      // Optimistic list update for immediate feedback after save.
      setInventoryItems((prev) => prev.map((item) => (item._id === updated._id ? { ...item, ...updated } : item)));
      setMarketplaceItems((prev) => prev.map((item) => (item._id === updated._id ? { ...item, ...updated } : item)));
      dispatch(fetchSellerProducts());

      toast.show('Product updated.', 'success');
      setEditModalVisible(false);
      setEditingProduct(null);
    } catch (editError: any) {
      toast.show(editError?.response?.data?.message || 'Failed to update product', 'error');
    } finally {
      setEditSaving(false);
    }
  }, [editingProduct, dispatch]);

  const focusInventoryWithTemplate = (item: Product) => {
    setActiveSection('inventory');
    setDrawerOpen(false);
    setCategory(item.category || '');
    setMinOrderQuantity(String(item.minOrderQuantity || 1));
    if (!name) setName(`Your ${item.name}`);
    if (!description) setDescription(`Bulk supply for ${item.category}.`);
  };

  const setOutOfStock = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await api.put(`/products/${id}`, { stock: 0 });
      toast.show('Product marked as out of stock.', 'success');
      setInventoryItems((prev) => prev.map((item) => (item._id === id ? { ...item, stock: 0 } : item)));
      setMarketplaceItems((prev) => prev.map((item) => (item._id === id ? { ...item, stock: 0 } : item)));
      dispatch(fetchSellerProducts());
    } catch (stockError: any) {
      toast.show(stockError?.response?.data?.message || 'Failed to update stock', 'error');
    } finally {
      setBusy(false);
    }
  }, [dispatch]);

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingProduct(null);
  };

  const renderInventoryContent = () => {
    if (inventoryLoading) {
      return (
        <View style={styles.list}>
          {[0, 1, 2].map((idx) => (
            <ProductCardSkeleton key={`inventory-skeleton-${idx}`} />
          ))}
        </View>
      );
    }

    if (!inventoryItems.length) {
      return (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="package-variant-closed-remove" size={34} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptyHint}>Tap the + Add Product button to create your first listing.</Text>
        </View>
      );
    }

    return (
      <View style={styles.list}>
        <View style={styles.analyticsGrid}>
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsValue}>{inventoryAnalytics.totalProducts}</Text>
            <Text style={styles.analyticsLabel}>Products</Text>
          </View>
          <View style={[styles.analyticsCard, styles.analyticsCardSuccess]}>
            <Text style={styles.analyticsValue}>{inventoryAnalytics.inStock}</Text>
            <Text style={styles.analyticsLabel}>In stock</Text>
          </View>
          <View style={[styles.analyticsCard, styles.analyticsCardWarn]}>
            <Text style={styles.analyticsValue}>{inventoryAnalytics.lowStock}</Text>
            <Text style={styles.analyticsLabel}>Low stock</Text>
          </View>
          <View style={[styles.analyticsCard, styles.analyticsCardDanger]}>
            <Text style={styles.analyticsValue}>{inventoryAnalytics.outOfStock}</Text>
            <Text style={styles.analyticsLabel}>Out of stock</Text>
          </View>
        </View>

        <View style={styles.analyticsStrip}>
          <View style={styles.analyticsStripRow}>
            <Text style={styles.analyticsStripLabel}>Total units in inventory</Text>
            <Text style={styles.analyticsStripValue}>{inventoryAnalytics.totalUnits}</Text>
          </View>
          <View style={styles.analyticsStripRow}>
            <Text style={styles.analyticsStripLabel}>Low stock rate</Text>
            <Text style={styles.analyticsStripValue}>{inventoryAnalytics.lowStockRate}%</Text>
          </View>
        </View>

        {inventoryItems.map((item, index) => (
          <FadeInCard key={item._id} index={index}>
            <View style={styles.productWrap}>
              <View style={styles.stockSummaryRow}>
                <View
                  style={[
                    styles.stockDot,
                    getStockStatus(item.stock) === 'in_stock' && styles.stockDotGreen,
                    getStockStatus(item.stock) === 'low_stock' && styles.stockDotAmber,
                    getStockStatus(item.stock) === 'out_of_stock' && styles.stockDotRed
                  ]}
                />
                <Text style={styles.stockSummaryText}>{getStockLabel(item.stock)}</Text>
              </View>
              <ProductCard product={item} compact />
              <View style={styles.rowButtons}>
                <View style={styles.halfButton}>
                  <AppButton title="Edit" icon="pencil" variant="secondary" onPress={() => startEdit(item)} />
                </View>
                <View style={styles.halfButton}>
                  <AppButton title="Delete" icon="delete" variant="danger" onPress={() => deleteProduct(item._id)} />
                </View>
              </View>
              <AppButton
                title={item.stock < 10 ? 'Out of Stock' : 'Set Out of Stock'}
                icon="alert-circle"
                variant="secondary"
                disabled={item.stock < 10}
                onPress={() => setOutOfStock(item._id)}
              />
            </View>
          </FadeInCard>
        ))}
      </View>
    );
  };

  useEffect(() => {
    if (route.params?.openSection) {
      setActiveSection(route.params.openSection);
    }

    if (route.params?.editProduct) {
      startEdit(route.params.editProduct);
    }
  }, [route.params?.openSection, route.params?.editProduct?._id]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroHeading}>Seller Workspace</Text>
              <Text style={styles.heroSub}>Welcome, {user?.name || 'Seller'}</Text>
            </View>

            <TouchableOpacity style={styles.menuButton} onPress={() => setDrawerOpen((prev) => !prev)}>
              <MaterialCommunityIcons name="menu" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.heroMode}>Mode: {activeSection === 'inventory' ? 'Inventory' : 'Marketplace'}</Text>
        </View>

        {activeSection === 'inventory' ? (
          <>
            <Text style={styles.subTitle}>Create Product</Text>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Basic Details</Text>
              <AppInput label="Product Name" value={name} onChangeText={setName} />
              <AppInput label="Description" value={description} onChangeText={setDescription} multiline />
              <AppInput label="Category" value={category} onChangeText={setCategory} />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Pricing & Inventory</Text>
              <AppInput label="Price" value={price} onChangeText={setPrice} keyboardType="numeric" />
              <AppInput label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
              <AppInput
                label="Minimum Order Quantity"
                value={minOrderQuantity}
                onChangeText={setMinOrderQuantity}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Product Image</Text>
              <AppButton title={selectedImage ? 'Change Image' : 'Choose Image'} icon="image-plus" variant="secondary" onPress={pickImage} />
              {imagePreviewUrl ? <Image source={{ uri: imagePreviewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
              {!imagePreviewUrl ? <Text style={styles.hint}>No image selected.</Text> : null}
            </View>

            <AppButton title="Open Add Product Form" icon="plus-circle" onPress={() => navigation.navigate('AddProduct')} />

            <Text style={styles.subTitle}>{user?.role === 'admin' ? 'Products' : 'Your Products'}</Text>
            {renderInventoryContent()}
          </>
        ) : (
          <>
            <Text style={styles.subTitle}>Marketplace Discovery</Text>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Find What You Want to Sell</Text>
              <AppInput
                label="Search"
                value={marketplaceSearch}
                onChangeText={setMarketplaceSearch}
                placeholder="Search products or categories"
              />

              <View style={styles.rowButtons}>
                <View style={styles.halfButton}>
                  <AppButton title="Search" icon="magnify" onPress={() => loadMarketplace(marketplaceSearch, marketplaceCategory)} />
                </View>
                <View style={styles.halfButton}>
                  <AppButton
                    title="Reset"
                    icon="refresh"
                    variant="secondary"
                    onPress={() => {
                      setMarketplaceSearch('');
                      setMarketplaceCategory('');
                      loadMarketplace('', '');
                    }}
                  />
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                <Pressable
                  onPress={() => {
                    setMarketplaceCategory('');
                    loadMarketplace(marketplaceSearch, '');
                  }}
                  style={[styles.categoryChip, !marketplaceCategory && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryText, !marketplaceCategory && styles.categoryTextActive]}>All</Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setMarketplaceCategory(cat);
                      loadMarketplace(marketplaceSearch, cat);
                    }}
                    style={[styles.categoryChip, marketplaceCategory === cat && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryText, marketplaceCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {marketplaceLoading ? (
              <View style={styles.list}>
                {[0, 1, 2].map((idx) => (
                  <ProductCardSkeleton key={`market-skeleton-${idx}`} />
                ))}
              </View>
            ) : null}

            {!marketplaceLoading && !marketplaceItems.length ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="store-search-outline" size={34} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No products found</Text>
                <Text style={styles.emptyHint}>Try changing search text or category filters.</Text>
              </View>
            ) : null}

            {!marketplaceLoading ? (
              <View style={styles.list}>
                {marketplaceItems.map((item, index) => (
                  <FadeInCard key={item._id} index={index}>
                    <View style={styles.productWrap}>
                      <ProductCard
                        product={item}
                        compact
                        onView={() => navigation.navigate('ProductDetails', { productId: item._id, product: item })}
                      />
                      <AppButton title="Sell Similar" icon="store-plus" variant="secondary" onPress={() => focusInventoryWithTemplate(item)} />
                    </View>
                  </FadeInCard>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {activeSection === 'inventory' ? (
        <Pressable
          onPress={() => navigation.navigate('AddProduct')}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <MaterialCommunityIcons name="plus" size={24} color={colors.white} />
          <Text style={styles.fabLabel}>Add Product</Text>
        </Pressable>
      ) : null}

      <EditProductBottomSheet
        visible={editModalVisible}
        product={editingProduct}
        categories={categories}
        saving={editSaving}
        onClose={closeEditModal}
        onSave={saveEdit}
      />

      {drawerOpen ? (
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawerPanel}>
            <Text style={styles.drawerTitle}>Seller Menu</Text>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setActiveSection('inventory');
                setDrawerOpen(false);
              }}
            >
              <View style={styles.drawerItemRow}>
                <MaterialCommunityIcons name="warehouse" size={18} color="#eff6ff" />
                <Text style={styles.drawerItemText}>Inventory</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setActiveSection('marketplace');
                setDrawerOpen(false);
              }}
            >
              <View style={styles.drawerItemRow}>
                <MaterialCommunityIcons name="store-search-outline" size={18} color="#eff6ff" />
                <Text style={styles.drawerItemText}>Marketplace</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                navigation.navigate('Orders');
                setDrawerOpen(false);
              }}
            >
              <View style={styles.drawerItemRow}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={18} color="#eff6ff" />
                <Text style={styles.drawerItemText}>Orders</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerItem, styles.drawerLogout]}
              onPress={() => {
                setDrawerOpen(false);
                dispatch(logout());
              }}
            >
              <View style={styles.drawerItemRow}>
                <MaterialCommunityIcons name="logout" size={18} color="#eff6ff" />
                <Text style={styles.drawerItemText}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <BeverageLoader
        visible={loggingOut}
        mode="auth"
        title="AP Enterprises"
        subtitle="Signing out of seller portal..."
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a1325'
  },
  content: {
    padding: spacing.x2,
    gap: spacing.x2,
    paddingBottom: spacing.x4 * 4
  },
  hero: {
    backgroundColor: '#0f274a',
    borderColor: '#1f4d89',
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing.x2,
    gap: spacing.x2,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b3b6f'
  },
  menuIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800'
  },
  menuLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  heroHeading: {
    color: '#f8fbff',
    fontSize: typeScale.title,
    fontWeight: '800'
  },
  heroSub: {
    color: '#c9ddff',
    fontSize: typeScale.small,
    marginTop: 2
  },
  heroMode: {
    color: '#dbe8ff',
    fontSize: typeScale.small,
    fontWeight: '600'
  },
  subTitle: {
    color: colors.text,
    fontSize: typeScale.subtitle,
    fontWeight: '800',
    marginTop: 4
  },
  sectionCard: {
    backgroundColor: '#101d34',
    borderColor: '#20375e',
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.x2,
    gap: spacing.x1,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typeScale.label,
    fontWeight: '700'
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: colors.cardAlt
  },
  hint: {
    color: colors.textMuted,
    fontSize: typeScale.small
  },
  rowButtons: {
    flexDirection: 'row',
    gap: spacing.x1
  },
  halfButton: {
    flex: 1
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  analyticsCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#10203a',
    borderWidth: 1,
    borderColor: '#22324f',
    borderRadius: 16,
    padding: 14,
    gap: 4
  },
  analyticsCardSuccess: {
    backgroundColor: '#0f2a1c',
    borderColor: '#1f5f3e'
  },
  analyticsCardWarn: {
    backgroundColor: '#2f2109',
    borderColor: '#8a6320'
  },
  analyticsCardDanger: {
    backgroundColor: '#2e1111',
    borderColor: '#7f1d1d'
  },
  analyticsValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800'
  },
  analyticsLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  analyticsStrip: {
    backgroundColor: '#101d34',
    borderWidth: 1,
    borderColor: '#22324f',
    borderRadius: 16,
    padding: 14,
    gap: 10
  },
  analyticsStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  analyticsStripLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  analyticsStripValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  stockSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2
  },
  stockDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#16a34a'
  },
  stockDotGreen: {
    backgroundColor: '#16a34a'
  },
  stockDotAmber: {
    backgroundColor: '#f59e0b'
  },
  stockDotRed: {
    backgroundColor: '#dc2626'
  },
  stockSummaryText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700'
  },
  list: {
    gap: spacing.x2
  },
  productWrap: {
    gap: spacing.x1,
    backgroundColor: '#101d34',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#20375e',
    padding: spacing.x1,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  categoryRow: {
    gap: spacing.x1,
    paddingVertical: 4
  },
  categoryChip: {
    backgroundColor: '#17325d',
    borderWidth: 1,
    borderColor: '#2d4f86',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  categoryChipActive: {
    backgroundColor: '#ffd07f',
    borderColor: '#ffdca2'
  },
  categoryText: {
    color: '#c7dbff',
    fontWeight: '600',
    fontSize: typeScale.small
  },
  categoryTextActive: {
    color: '#563a00'
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row'
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  drawerPanel: {
    width: 230,
    backgroundColor: '#0f2342',
    borderLeftWidth: 1,
    borderColor: '#274b7f',
    padding: 16,
    gap: 8
  },
  drawerTitle: {
    color: '#f3f8ff',
    fontSize: typeScale.subtitle,
    fontWeight: '800',
    marginBottom: spacing.x1
  },
  drawerItem: {
    backgroundColor: '#15335f',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  drawerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  drawerLogout: {
    marginTop: 8,
    backgroundColor: '#7a1d2d'
  },
  drawerItemText: {
    color: '#eff6ff',
    fontWeight: '700'
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#28426d',
    backgroundColor: '#12233f',
    alignItems: 'center',
    paddingVertical: spacing.x3,
    paddingHorizontal: spacing.x2,
    gap: spacing.x1
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typeScale.label,
    fontWeight: '800'
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: typeScale.small,
    textAlign: 'center'
  },
  fab: {
    position: 'absolute',
    right: spacing.x2,
    bottom: spacing.x3,
    backgroundColor: colors.primary,
    borderRadius: 999,
    minHeight: 52,
    paddingHorizontal: spacing.x2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x1,
    borderWidth: 1,
    borderColor: '#5b8ff8',
    shadowColor: '#00183f',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  fabLabel: {
    color: colors.white,
    fontSize: typeScale.label,
    fontWeight: '800'
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }]
  }
});
