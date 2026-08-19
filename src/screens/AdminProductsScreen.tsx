import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorView } from '../components/StateViews';
import { AppButton } from '../components/AppButton';
import { API_BASE_URL, api } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { Product } from '../constants/types';
import { RootStackParamList } from '../navigation/types';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminProducts'>;
type Filter = 'all' | 'active' | 'inactive' | 'low-stock' | 'featured';
type Pagination = { total: number; page: number; limit: number; totalPages: number };

const filters: Array<{ key: Filter; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }> = [
  { key: 'all', label: 'All', icon: 'view-grid-outline' },
  { key: 'active', label: 'Active', icon: 'check-circle-outline' },
  { key: 'inactive', label: 'Inactive', icon: 'pause-circle-outline' },
  { key: 'low-stock', label: 'Low stock', icon: 'alert-circle-outline' },
  { key: 'featured', label: 'Featured', icon: 'lightning-bolt-outline' }
];

const imageUrl = (raw?: string) => raw ? (raw.startsWith('http') ? raw : `${API_BASE_URL.replace('/api', '')}${raw}`) : '';

const FadeCard: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => { Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: 220, delay: Math.min(6, index) * 45, useNativeDriver: true }), Animated.timing(translateY, { toValue: 0, duration: 220, delay: Math.min(6, index) * 45, useNativeDriver: true })]).start(); }, [index, opacity, translateY]);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
};

export const AdminProductsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = useCallback(async (page = 1, options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/products', { params: { page, limit: 12, search: search.trim(), status: filter, sort } });
      setItems(response.data.data || []);
      setPagination(response.data.pagination || { total: 0, page, limit: 12, totalPages: 1 });
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'Unable to load products.';
      setError(message);
      toast.show(message, 'error');
    } finally { setLoading(false); setRefreshing(false); }
  }, [filter, search, sort]);

  useEffect(() => { const timer = setTimeout(() => loadProducts(1), 280); return () => clearTimeout(timer); }, [loadProducts]);
  useEffect(() => { const unsubscribe = navigation.addListener('focus', () => loadProducts(1, { silent: true })); return unsubscribe; }, [loadProducts, navigation]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/products/${deleteTarget._id}`);
      toast.show('Product deleted successfully.', 'success');
      setDeleteTarget(null);
      await loadProducts(items.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page, { silent: true });
    } catch (requestError: any) {
      toast.show(requestError?.response?.data?.message || "Couldn't delete product. Please try again.", 'error');
    } finally { setDeleting(false); }
  };

  const renderItem = ({ item, index }: { item: Product; index: number }) => {
    const uri = imageUrl(item.imageUrl);
    const active = item.isActive !== false;
    const outOfStock = item.stock <= 0;
    const lowStock = item.stock > 0 && item.stock < 10;
    return <FadeCard index={index}><View style={styles.productCard}><View style={styles.productTop}>{uri ? <Image source={{ uri }} style={styles.productImage} resizeMode="contain" /> : <View style={styles.productImageFallback}><MaterialCommunityIcons name="bottle-soda-classic-outline" size={28} color={colors.primary} /></View>}<View style={styles.productCopy}><View style={styles.badges}><View style={[styles.badge, { backgroundColor: active ? colors.successSurface : colors.cardAlt, borderColor: active ? colors.successBorder : colors.border }]}><MaterialCommunityIcons name={active ? 'check-circle-outline' : 'pause-circle-outline'} size={12} color={active ? colors.success : colors.textSecondary} /><Text style={[styles.badgeText, { color: active ? colors.success : colors.textSecondary }]}>{active ? 'Active' : 'Inactive'}</Text></View>{item.isFeatured ? <View style={[styles.badge, styles.featuredBadge]}><MaterialCommunityIcons name="lightning-bolt" size={12} color="#B45309" /><Text style={[styles.badgeText, { color: '#B45309' }]}>Featured</Text></View> : null}</View><Text style={styles.productName} numberOfLines={2}>{item.name}</Text><Text style={styles.productCategory}>{item.category}</Text></View></View><View style={styles.metricRow}><View><Text style={styles.metricLabel}>Case Price</Text><Text style={styles.metricValue}>${item.price.toFixed(2)}</Text></View><View><Text style={styles.metricLabel}>Stock</Text><Text style={[styles.metricValue, (outOfStock || lowStock) && styles.metricWarning]}>{outOfStock ? 'Out' : `${item.stock} cs`}</Text></View><View><Text style={styles.metricLabel}>MOQ</Text><Text style={styles.metricValue}>{item.minOrderQuantity || 1}+</Text></View><View><Text style={styles.metricLabel}>Status</Text><Text style={[styles.metricValue, outOfStock ? styles.metricWarning : lowStock ? styles.metricWarning : styles.metricGood]}>{outOfStock ? 'Out' : lowStock ? 'Low' : 'Ready'}</Text></View></View><View style={styles.actions}><Pressable style={styles.editButton} onPress={() => navigation.navigate('AddProduct', { product: item })}><MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} /><Text style={styles.editText}>Edit</Text></Pressable><Pressable style={styles.deleteButton} onPress={() => setDeleteTarget(item)}><MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.danger} /><Text style={styles.deleteText}>Delete</Text></Pressable></View></View></FadeCard>;
  };

  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}><View style={styles.header}><Pressable accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable><View style={styles.headerCopy}><Text style={styles.headerTitle}>Beverage Catalog</Text><Text style={styles.headerSubtitle}>Manage your wholesale beverage inventory.</Text></View><Pressable accessibilityLabel="Add product" onPress={() => navigation.navigate('AddProduct')} style={styles.addButton}><MaterialCommunityIcons name="plus" size={20} color={colors.white} /></Pressable></View><View style={styles.searchField}><MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search beverages..." placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" /><MaterialCommunityIcons name="tune-variant" size={18} color={colors.primary} /></View><View><Text style={styles.filterLabel}>FILTER CATALOG</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{filters.map((item) => <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filterChip, filter === item.key && styles.filterChipActive]}><MaterialCommunityIcons name={item.icon} size={15} color={filter === item.key ? colors.white : colors.textSecondary} /><Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</ScrollView></View><View style={styles.listMeta}><Text style={styles.resultText}>{pagination.total} product{pagination.total === 1 ? '' : 's'}</Text><Pressable style={styles.sortButton} onPress={() => setSort((current) => current === 'newest' ? 'price-low' : current === 'price-low' ? 'price-high' : 'newest')}><MaterialCommunityIcons name="sort" size={16} color={colors.primary} /><Text style={styles.sortText}>{sort === 'newest' ? 'Newest' : sort === 'price-low' ? 'Price: low' : 'Price: high'}</Text></Pressable></View>{error && !items.length ? <View style={styles.errorWrap}><ErrorView message={error} /><AppButton title="Retry" icon="refresh" variant="secondary" onPress={() => loadProducts(1)} /></View> : <Animated.FlatList data={items} keyExtractor={(item) => item._id} renderItem={renderItem} contentContainerStyle={[styles.list, { paddingBottom: Math.max(28, insets.bottom + 22) }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProducts(pagination.page); }} tintColor={colors.primary} />} ListEmptyComponent={loading ? <View style={styles.loadingCard}><MaterialCommunityIcons name="loading" size={25} color={colors.primary} /><Text style={styles.loadingText}>Loading catalog...</Text></View> : <EmptyState icon="package-variant-closed" title="No products match" description="Try another search or filter, or add your first catalog item." actionLabel="Add product" onAction={() => navigation.navigate('AddProduct')} />} ListFooterComponent={pagination.totalPages > 1 ? <View style={styles.pagination}><Pressable disabled={pagination.page <= 1} onPress={() => loadProducts(pagination.page - 1)} style={[styles.pageButton, pagination.page <= 1 && styles.pageButtonDisabled]}><MaterialCommunityIcons name="chevron-left" size={18} color={pagination.page <= 1 ? colors.textMuted : colors.primary} /><Text style={styles.pageButtonText}>Previous</Text></Pressable><Text style={styles.pageText}>Page {pagination.page} of {pagination.totalPages}</Text><Pressable disabled={pagination.page >= pagination.totalPages} onPress={() => loadProducts(pagination.page + 1)} style={[styles.pageButton, pagination.page >= pagination.totalPages && styles.pageButtonDisabled]}><Text style={styles.pageButtonText}>Next</Text><MaterialCommunityIcons name="chevron-right" size={18} color={pagination.page >= pagination.totalPages ? colors.textMuted : colors.primary} /></Pressable></View> : null} />}
    <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => !deleting && setDeleteTarget(null)}><View style={styles.modalBackdrop}><View style={styles.confirmCard}><View style={styles.confirmIcon}><MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.danger} /></View><Text style={styles.confirmTitle}>Delete product?</Text><Text style={styles.confirmText}>Are you sure you want to remove {deleteTarget?.name || 'this product'}? This action cannot be easily undone.</Text><View style={styles.confirmActions}><View style={styles.confirmHalf}><AppButton title="Cancel" variant="secondary" disabled={deleting} onPress={() => setDeleteTarget(null)} /></View><View style={styles.confirmHalf}><AppButton title={deleting ? 'Deleting...' : 'Delete Product'} icon="trash-can-outline" variant="danger" loading={deleting} onPress={confirmDelete} /></View></View></View></View></Modal>
  </SafeAreaView>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  backButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  headerSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.floating },
  searchField: { height: 52, marginHorizontal: 16, borderRadius: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, ...shadows.card },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  filterLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.9, fontWeight: '900', marginHorizontal: 16, marginTop: 19, marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingBottom: 14 },
  filterChip: { minHeight: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  filterTextActive: { color: colors.white },
  listMeta: { paddingHorizontal: 16, paddingBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  sortButton: { minHeight: 34, borderRadius: 10, backgroundColor: colors.infoSurface, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: colors.primaryPressed, fontSize: 11, fontWeight: '800' },
  list: { paddingHorizontal: 16, gap: 11 },
  productCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 13, gap: 12, ...shadows.card },
  productTop: { flexDirection: 'row', gap: 11 },
  productImage: { width: 78, height: 78, borderRadius: radius.md, backgroundColor: colors.cardAlt },
  productImageFallback: { width: 78, height: 78, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  productCopy: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  featuredBadge: { backgroundColor: colors.warningSurface, borderColor: colors.warningBorder },
  badgeText: { fontSize: 10, fontWeight: '900' },
  productName: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  productCategory: { color: colors.textSecondary, fontSize: 12 },
  metricRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { color: colors.textMuted, fontSize: 10 },
  metricValue: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 },
  metricWarning: { color: colors.danger },
  metricGood: { color: colors.success },
  actions: { flexDirection: 'row', gap: 8 },
  editButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.infoSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  editText: { color: colors.primaryPressed, fontSize: 12, fontWeight: '900' },
  deleteButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.dangerSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  loadingCard: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorWrap: { paddingHorizontal: 16, alignItems: 'center' },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  pageButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 2 },
  pageButtonDisabled: { backgroundColor: colors.cardAlt },
  pageButtonText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  pageText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.34)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  confirmCard: { width: '100%', maxWidth: 420, backgroundColor: colors.card, borderRadius: 22, padding: 20, gap: 12, ...shadows.floating },
  confirmIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.dangerSurface, alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  confirmText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  confirmActions: { flexDirection: 'row', gap: 9, marginTop: 4 },
  confirmHalf: { flex: 1 }
});
