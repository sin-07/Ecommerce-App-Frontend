import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductForm, ProductFormPayload } from '../components/ProductForm';
import { api, API_BASE_URL } from '../constants/api';
import { colors, radius } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../hooks/reduxHooks';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;
const categories = ['Soft Drinks', 'Juices', 'Energy Drinks', 'Water & Soda', 'Tea & Coffee', 'Dairy Beverages'];

export const AddProductScreen: React.FC<Props> = ({ navigation, route }) => {
  const product = route.params?.product;
  const { user } = useAppSelector((state) => state.auth);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(product?._id);
  const initialValues = useMemo(() => product ? {
    name: product.name,
    description: product.description,
    category: product.category,
    price: String(product.price),
    stock: String(product.stock),
    minOrderQuantity: String(product.minOrderQuantity || 1),
    discount: String(product.discount || 0),
    sku: product.sku || '',
    isFeatured: Boolean(product.isFeatured),
    isActive: product.isActive !== false,
    imageUrl: product.imageUrl ? (product.imageUrl.startsWith('http') ? product.imageUrl : `${API_BASE_URL.replace('/api', '')}${product.imageUrl}`) : ''
  } : undefined, [product]);

  const handleSubmit = async (payload: ProductFormPayload) => {
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('name', payload.name);
      form.append('description', payload.description);
      form.append('category', payload.category);
      form.append('price', String(payload.price));
      form.append('discount', String(payload.discount));
      form.append('stock', String(payload.stock));
      form.append('minOrderQuantity', String(payload.minOrderQuantity));
      form.append('sku', payload.sku);
      form.append('isFeatured', String(payload.isFeatured));
      form.append('isActive', String(payload.isActive));
      if (payload.imageAsset?.uri) form.append('image', { uri: payload.imageAsset.uri, name: payload.imageAsset.fileName || `product-${Date.now()}.jpg`, type: payload.imageAsset.mimeType || 'image/jpeg' } as any);

      const basePath = user?.role === 'admin' ? '/admin/products' : '/products';
      const endpoint = isEditing ? (route.params?.product?._id && `${basePath}/${route.params.product._id}`) : basePath;
      if (!endpoint) throw new Error('Product identifier is missing.');
      if (isEditing) await api.put(endpoint, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      else await api.post(endpoint, form, { headers: { 'Content-Type': 'multipart/form-data' } });

      toast.show(isEditing ? 'Product updated successfully.' : 'Product added successfully.', 'success');
      navigation.goBack();
    } catch (error: any) {
      const validationErrors = error?.response?.data?.errors;
      const message = Array.isArray(validationErrors) && validationErrors.length
        ? validationErrors.join(' ')
        : error?.response?.data?.message || (isEditing ? 'Could not update product.' : 'Could not add product.');
      toast.show(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><View style={styles.header}><Pressable accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable><View><Text style={styles.headerTitle}>{isEditing ? 'Edit Product' : 'Add Product'}</Text><Text style={styles.headerSubtitle}>{isEditing ? 'Update product information' : 'Add a product to your marketplace catalog.'}</Text></View></View><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.hero}><View style={styles.heroIcon}><MaterialCommunityIcons name={isEditing ? 'pencil-box-outline' : 'package-variant-plus'} size={25} color={colors.primary} /></View><View style={styles.heroCopy}><Text style={styles.title}>{isEditing ? 'Update your catalog item' : 'Add New Product'}</Text><Text style={styles.subtitle}>{isEditing ? 'Keep pricing, stock, and merchandising information current.' : 'Create a clear, useful listing for your wholesale buyers.'}</Text></View></View><ProductForm categories={categories} initialValues={initialValues} submitLabel={isEditing ? 'Save Changes' : 'Add Product'} loading={submitting} onSubmit={handleSubmit} /></ScrollView></KeyboardAvoidingView></SafeAreaView>;
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  back: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  headerSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  hero: { borderRadius: radius.lg, backgroundColor: colors.infoSurface, borderWidth: 1, borderColor: colors.infoBorder, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 }
});
