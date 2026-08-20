import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from './AppButton';
import { AppInput } from './AppInput';
import { AnimatedDropdown } from './AnimatedDropdown';
import { colors, radius, shadows } from '../constants/theme';
import { toast } from '../utils/toast';

export type ProductFormValues = {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  minOrderQuantity: string;
  discount: string;
  sku: string;
  unit: string;
  packSize: string;
  badge: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  imageUrl?: string;
};

export type ProductFormPayload = {
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  minOrderQuantity: number;
  discount: number;
  sku: string;
  unit: string;
  packSize: string;
  badge: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  imageAsset: ImagePicker.ImagePickerAsset | null;
};

type Props = {
  categories?: string[];
  initialValues?: Partial<ProductFormValues>;
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (payload: ProductFormPayload) => void | Promise<void>;
};

export const PRODUCT_CATEGORIES = [
  'Beverages',
  'Eggs',
  'Existing Products',
  'Soft Drinks',
  'Juices',
  'Energy Drinks',
  'Water & Soda',
  'Snacks',
  'General Wholesale'
];

export const PRODUCT_UNITS = [
  'piece',
  'dozen',
  'tray',
  'crate',
  'can',
  'bottle',
  'pack',
  'box',
  'bag',
  'kg'
];

const defaults: ProductFormValues = {
  name: '',
  description: '',
  category: 'Beverages',
  price: '',
  stock: '',
  minOrderQuantity: '1',
  discount: '0',
  sku: '',
  unit: 'piece',
  packSize: '',
  badge: '',
  isFeatured: false,
  isBestSeller: false,
  isActive: true
};

export const ProductForm: React.FC<Props> = ({
  categories = PRODUCT_CATEGORIES,
  initialValues,
  submitLabel = 'Save Product',
  loading = false,
  onSubmit
}) => {
  const [values, setValues] = useState<ProductFormValues>({ ...defaults, ...initialValues });
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setValues({ ...defaults, ...initialValues });
    setSelectedImage(null);
    setError('');
  }, [
    initialValues?.name,
    initialValues?.description,
    initialValues?.category,
    initialValues?.price,
    initialValues?.stock,
    initialValues?.minOrderQuantity,
    initialValues?.discount,
    initialValues?.sku,
    initialValues?.unit,
    initialValues?.packSize,
    initialValues?.badge,
    initialValues?.isFeatured,
    initialValues?.isBestSeller,
    initialValues?.isActive,
    initialValues?.imageUrl
  ]);

  const update = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const parsed = useMemo(
    () => ({
      price: Number(values.price),
      stock: Number(values.stock),
      moq: Number(values.minOrderQuantity),
      discount: Number(values.discount)
    }),
    [values.price, values.stock, values.minOrderQuantity, values.discount]
  );

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      toast.error('Please allow photo access to select a product image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85
    });
    if (!result.canceled && result.assets.length) setSelectedImage(result.assets[0]);
  };

  const validate = () => {
    let message = '';
    if (values.name.trim().length < 2) message = 'Product name must be at least 2 characters.';
    else if (values.description.trim().length < 10) message = 'Description must be at least 10 characters.';
    else if (!values.category.trim()) message = 'Select a product category.';
    else if (!values.price.trim() || Number.isNaN(parsed.price) || parsed.price < 0)
      message = 'Enter a valid price in ₹.';
    else if (!values.stock.trim() || Number.isNaN(parsed.stock) || parsed.stock < 0)
      message = 'Stock must be 0 or greater.';
    else if (!values.minOrderQuantity.trim() || Number.isNaN(parsed.moq) || parsed.moq < 1)
      message = 'MOQ must be at least 1.';
    else if (Number.isNaN(parsed.discount) || parsed.discount < 0 || parsed.discount > 100)
      message = 'Discount must be between 0 and 100.';
    setError(message);
    return message;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      price: parsed.price,
      stock: parsed.stock,
      minOrderQuantity: parsed.moq,
      discount: parsed.discount,
      sku: values.sku.trim(),
      unit: values.unit.trim() || 'piece',
      packSize: values.packSize.trim(),
      badge: values.badge.trim(),
      isFeatured: values.isFeatured,
      isBestSeller: values.isBestSeller,
      isActive: values.isActive,
      imageAsset: selectedImage
    });
  };

  const allCategories = useMemo(() => {
    const set = new Set([...PRODUCT_CATEGORIES, ...categories]);
    return Array.from(set);
  }, [categories]);

  return (
    <View style={styles.root}>
      {/* PRODUCT BASIC INFO */}
      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <View>
            <Text style={styles.cardTitle}>Product Information</Text>
            <Text style={styles.cardSubtitle}>Title, category, description & packaging configuration.</Text>
          </View>
          <MaterialCommunityIcons name="package-variant-closed" size={23} color={colors.primary} />
        </View>

        <AppInput
          label="Product Name *"
          value={values.name}
          onChangeText={(v) => update('name', v)}
          placeholder="e.g. Farm Fresh Table Eggs (Tray of 30) / Coca-Cola (330ml)"
        />

        {/* ANIMATED CATEGORY DROPDOWN */}
        <AnimatedDropdown
          label="Category"
          required
          selectedValue={values.category}
          options={allCategories}
          onSelect={(cat) => update('category', cat)}
          placeholder="Select category (e.g. Eggs, Beverages)"
        />

        {/* UNIT & PACK SIZE */}
        <View style={styles.twoCol}>
          <View style={styles.flex}>
            <AnimatedDropdown
              label="Selling Unit"
              selectedValue={values.unit}
              options={PRODUCT_UNITS}
              onSelect={(u) => update('unit', u)}
              placeholder="Unit"
            />
          </View>

          <View style={styles.flex}>
            <AppInput
              label="Pack Size / Details"
              value={values.packSize}
              onChangeText={(v) => update('packSize', v)}
              placeholder="e.g. 30 Eggs / Tray, 24 Cans"
            />
          </View>
        </View>

        <AppInput
          label="Description *"
          value={values.description}
          onChangeText={(v) => update('description', v)}
          placeholder="Describe wholesale specifications, packaging, and shelf life."
          multiline
        />

        <View style={styles.twoCol}>
          <View style={styles.flex}>
            <AppInput
              label="SKU / Item Code"
              value={values.sku}
              onChangeText={(v) => update('sku', v)}
              placeholder="e.g. EGG-30-TRAY"
            />
          </View>
          <View style={styles.flex}>
            <AppInput
              label="Promo Badge Tag"
              value={values.badge}
              onChangeText={(v) => update('badge', v)}
              placeholder="e.g. Bestseller, Fresh"
            />
          </View>
        </View>
      </View>

      {/* PRICING & INVENTORY */}
      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <View>
            <Text style={styles.cardTitle}>Pricing & Inventory</Text>
            <Text style={styles.cardSubtitle}>Set wholesale price (₹), discount, stock & MOQ.</Text>
          </View>
          <MaterialCommunityIcons name="cash-multiple" size={23} color={colors.primary} />
        </View>

        <View style={styles.twoCol}>
          <View style={styles.flex}>
            <AppInput
              label="Price (₹) *"
              value={values.price}
              onChangeText={(v) => update('price', v)}
              keyboardType="numeric"
              placeholder="0.00"
            />
          </View>
          <View style={styles.flex}>
            <AppInput
              label="Discount %"
              value={values.discount}
              onChangeText={(v) => update('discount', v)}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.flex}>
            <AppInput
              label="Warehouse Stock *"
              value={values.stock}
              onChangeText={(v) => update('stock', v)}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
          <View style={styles.flex}>
            <AppInput
              label="Min Order Qty (MOQ)"
              value={values.minOrderQuantity}
              onChangeText={(v) => update('minOrderQuantity', v)}
              keyboardType="numeric"
              placeholder="1"
            />
          </View>
        </View>
      </View>

      {/* PRODUCT IMAGE */}
      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <View>
            <Text style={styles.cardTitle}>Product Image</Text>
            <Text style={styles.cardSubtitle}>High-res photo for egg cartons or beverage cans.</Text>
          </View>
          <MaterialCommunityIcons name="image-outline" size={23} color={colors.primary} />
        </View>

        <AppButton
          title={selectedImage ? 'Change Image' : 'Upload / Select Image'}
          icon="image-plus"
          variant="secondary"
          onPress={pickImage}
        />

        {selectedImage?.uri ? (
          <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
        ) : values.imageUrl ? (
          <Image source={{ uri: values.imageUrl }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.imageEmpty}>
            <MaterialCommunityIcons name="image-off-outline" size={28} color={colors.textMuted} />
            <Text style={styles.hint}>No image selected (Category icon will be used)</Text>
          </View>
        )}
      </View>

      {/* MERCHANDISING FLAGS */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>⭐ Featured on Buyer Home</Text>
            <Text style={styles.toggleHint}>Highlights this item in top promotional sections.</Text>
          </View>
          <Switch
            value={values.isFeatured}
            onValueChange={(v) => update('isFeatured', v)}
            trackColor={{ false: colors.border, true: colors.infoBorder }}
            thumbColor={values.isFeatured ? colors.primary : colors.white}
          />
        </View>

        <View style={styles.toggleDivider} />

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>🔥 Bestseller Badge</Text>
            <Text style={styles.toggleHint}>Flags item with Bestseller tag across catalog.</Text>
          </View>
          <Switch
            value={values.isBestSeller}
            onValueChange={(v) => update('isBestSeller', v)}
            trackColor={{ false: colors.border, true: colors.infoBorder }}
            thumbColor={values.isBestSeller ? '#F59E0B' : colors.white}
          />
        </View>

        <View style={styles.toggleDivider} />

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Active In Marketplace</Text>
            <Text style={styles.toggleHint}>Makes item visible and orderable by wholesale buyers.</Text>
          </View>
          <Switch
            value={values.isActive}
            onValueChange={(v) => update('isActive', v)}
            trackColor={{ false: colors.border, true: colors.successBorder }}
            thumbColor={values.isActive ? colors.success : colors.white}
          />
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <AppButton
        title={submitLabel}
        icon={submitLabel.toLowerCase().includes('save') ? 'content-save' : 'plus-circle'}
        loading={loading}
        onPress={handleSubmit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 15,
    gap: 11,
    ...shadows.card
  },
  cardHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 2
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  cardSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2, maxWidth: 280 },
  twoCol: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  imageEmpty: {
    height: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  hint: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  toggleHint: { color: colors.textSecondary, fontSize: 11.5, marginTop: 2 },
  toggleDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerSurface,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  error: { color: colors.danger, fontSize: 12.5, fontWeight: '700', flex: 1 }
});
