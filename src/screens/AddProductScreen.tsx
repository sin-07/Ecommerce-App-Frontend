import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductForm, ProductFormPayload } from '../components/ProductForm';
import { api, API_BASE_URL } from '../constants/api';
import { colors, radius } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../hooks/reduxHooks';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;

const DEFAULT_CATEGORIES = [
  'Beverages',
  'Eggs',
  'Existing Products',
  'Soft Drinks',
  'Juices',
  'Energy Drinks',
  'Water & Soda',
  'General Wholesale'
];

export const AddProductScreen: React.FC<Props> = ({ navigation, route }) => {
  const product = route.params?.product;
  const { user } = useAppSelector((state) => state.auth);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(product?._id);

  const initialValues = useMemo(
    () =>
      product
        ? {
            name: product.name,
            description: product.description,
            category: product.category || 'Beverages',
            price: String(product.price),
            stock: String(product.stock),
            minOrderQuantity: String(product.minOrderQuantity || 1),
            discount: String(product.discount || 0),
            sku: product.sku || '',
            unit: product.unit || 'piece',
            packSize: product.packSize || '',
            badge: product.badge || '',
            isFeatured: Boolean(product.isFeatured),
            isBestSeller: Boolean(product.isBestSeller),
            isActive: product.isActive !== false,
            imageUrl: product.imageUrl
              ? product.imageUrl.startsWith('http')
                ? product.imageUrl
                : `${API_BASE_URL.replace('/api', '')}${product.imageUrl}`
              : ''
          }
        : undefined,
    [product]
  );

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
      form.append('unit', payload.unit);
      form.append('packSize', payload.packSize);
      form.append('badge', payload.badge);
      form.append('isFeatured', String(payload.isFeatured));
      form.append('isBestSeller', String(payload.isBestSeller));
      form.append('isActive', String(payload.isActive));

      if (payload.imageAsset?.uri) {
        form.append('image', {
          uri: payload.imageAsset.uri,
          name: payload.imageAsset.fileName || `product-${Date.now()}.jpg`,
          type: payload.imageAsset.mimeType || 'image/jpeg'
        } as any);
      }

      const basePath = user?.role === 'admin' ? '/admin/products' : '/products';
      const endpoint = isEditing ? (route.params?.product?._id && `${basePath}/${route.params.product._id}`) : basePath;

      if (!endpoint) throw new Error('Product identifier is missing.');

      if (isEditing) {
        await api.put(endpoint, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post(endpoint, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      toast.success(isEditing ? 'Product updated successfully ✅' : 'Product added successfully ✅');
      navigation.goBack();
    } catch (error: any) {
      const validationErrors = error?.response?.data?.errors;
      const message =
        Array.isArray(validationErrors) && validationErrors.length
          ? validationErrors.join(' ')
          : error?.response?.data?.message || (isEditing ? 'Could not update product.' : 'Could not add product.');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Product' : 'Add Product'}</Text>
          <Text style={styles.headerSubtitle}>
            {isEditing ? 'Update beverage, egg or wholesale item details' : 'Add a new product to your catalog'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons
                name={isEditing ? 'pencil-box-outline' : 'package-variant-plus'}
                size={25}
                color={colors.primary}
              />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{isEditing ? 'Update Catalog Product' : 'Create New Product'}</Text>
              <Text style={styles.subtitle}>
                {isEditing
                  ? 'Keep pricing, stock, packaging, and unit details accurate.'
                  : 'Configure eggs trays, beverage cans, or wholesale supplies for buyers.'}
              </Text>
            </View>
          </View>

          <ProductForm
            categories={DEFAULT_CATEGORIES}
            initialValues={initialValues}
            submitLabel={isEditing ? 'Save Changes' : 'Create Product'}
            loading={submitting}
            onSubmit={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  headerSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  hero: {
    borderRadius: radius.lg,
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 2 }
});
