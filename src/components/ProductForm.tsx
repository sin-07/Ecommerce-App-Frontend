import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from './AppButton';
import { AppInput } from './AppInput';
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
  isFeatured: boolean;
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
  isFeatured: boolean;
  isActive: boolean;
  imageAsset: ImagePicker.ImagePickerAsset | null;
};

type Props = {
  categories: string[];
  initialValues?: Partial<ProductFormValues>;
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (payload: ProductFormPayload) => void | Promise<void>;
};

const defaults: ProductFormValues = { name: '', description: '', category: '', price: '', stock: '', minOrderQuantity: '1', discount: '0', sku: '', isFeatured: false, isActive: true };

export const ProductForm: React.FC<Props> = ({ categories, initialValues, submitLabel = 'Add Product', loading = false, onSubmit }) => {
  const [values, setValues] = useState<ProductFormValues>({ ...defaults, ...initialValues });
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setValues({ ...defaults, ...initialValues });
    setSelectedImage(null);
    setError('');
  }, [initialValues?.name, initialValues?.description, initialValues?.category, initialValues?.price, initialValues?.stock, initialValues?.minOrderQuantity, initialValues?.discount, initialValues?.sku, initialValues?.isFeatured, initialValues?.isActive, initialValues?.imageUrl]);

  const update = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => setValues((previous) => ({ ...previous, [key]: value }));
  const parsed = useMemo(() => ({ price: Number(values.price), stock: Number(values.stock), moq: Number(values.minOrderQuantity), discount: Number(values.discount) }), [values.price, values.stock, values.minOrderQuantity, values.discount]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo access to select a product image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets.length) setSelectedImage(result.assets[0]);
  };

  const validate = () => {
    let message = '';
    if (values.name.trim().length < 2) message = 'Product name must be at least 2 characters.';
    else if (values.description.trim().length < 10) message = 'Description must be at least 10 characters.';
    else if (!values.category.trim()) message = 'Select a category.';
    else if (!values.price.trim() || Number.isNaN(parsed.price) || parsed.price < 0) message = 'Enter a valid price.';
    else if (!values.stock.trim() || Number.isNaN(parsed.stock) || parsed.stock < 0) message = 'Stock must be 0 or greater.';
    else if (!values.minOrderQuantity.trim() || Number.isNaN(parsed.moq) || parsed.moq < 1) message = 'MOQ must be at least 1.';
    else if (Number.isNaN(parsed.discount) || parsed.discount < 0 || parsed.discount > 100) message = 'Discount must be between 0 and 100.';
    setError(message);
    return message;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) { toast.show(validationError, 'warning'); return; }
    await onSubmit({ name: values.name.trim(), description: values.description.trim(), category: values.category.trim(), price: parsed.price, stock: parsed.stock, minOrderQuantity: parsed.moq, discount: parsed.discount, sku: values.sku.trim(), isFeatured: values.isFeatured, isActive: values.isActive, imageAsset: selectedImage });
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.cardHeading}><View><Text style={styles.cardTitle}>Product information</Text><Text style={styles.cardSubtitle}>Give buyers the context they need to reorder confidently.</Text></View><MaterialCommunityIcons name="package-variant-closed" size={23} color={colors.primary} /></View>
        <AppInput label="Product name" value={values.name} onChangeText={(value) => update('name', value)} placeholder="Enter product name" />
        <AppInput label="Description" value={values.description} onChangeText={(value) => update('description', value)} placeholder="Describe what makes this product useful" multiline />
        <View style={styles.dropdownWrap}><Text style={styles.fieldLabel}>Category</Text><Menu visible={menuVisible} onDismiss={() => setMenuVisible(false)} anchor={<TouchableOpacity style={styles.dropdownAnchor} activeOpacity={0.9} onPress={() => setMenuVisible(true)}><Text style={[styles.dropdownText, !values.category && styles.dropdownPlaceholder]}>{values.category || 'Select category'}</Text><MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} /></TouchableOpacity>}>{categories.map((cat) => <Menu.Item key={cat} title={cat} onPress={() => { update('category', cat); setMenuVisible(false); }} />)}</Menu></View>
        <AppInput label="SKU / product ID" value={values.sku} onChangeText={(value) => update('sku', value)} placeholder="Optional internal reference" />
      </View>

      <View style={styles.card}><View style={styles.cardHeading}><View><Text style={styles.cardTitle}>Commercial details</Text><Text style={styles.cardSubtitle}>Set pricing and availability for wholesale buyers.</Text></View><MaterialCommunityIcons name="cash-multiple" size={23} color={colors.primary} /></View><View style={styles.twoCol}><View style={styles.flex}><AppInput label="Price" value={values.price} onChangeText={(value) => update('price', value)} keyboardType="numeric" placeholder="0.00" /></View><View style={styles.flex}><AppInput label="Discount %" value={values.discount} onChangeText={(value) => update('discount', value)} keyboardType="numeric" placeholder="0" /></View></View><View style={styles.twoCol}><View style={styles.flex}><AppInput label="MOQ" value={values.minOrderQuantity} onChangeText={(value) => update('minOrderQuantity', value)} keyboardType="numeric" placeholder="1" /></View><View style={styles.flex}><AppInput label="Stock" value={values.stock} onChangeText={(value) => update('stock', value)} keyboardType="numeric" placeholder="0" /></View></View></View>

      <View style={styles.card}><View style={styles.cardHeading}><View><Text style={styles.cardTitle}>Product image</Text><Text style={styles.cardSubtitle}>Use a clear product image for faster recognition.</Text></View><MaterialCommunityIcons name="image-outline" size={23} color={colors.primary} /></View><AppButton title={selectedImage ? 'Change image' : 'Select image'} icon="image-plus" variant="secondary" onPress={pickImage} />{selectedImage?.uri ? <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="contain" /> : values.imageUrl ? <Image source={{ uri: values.imageUrl }} style={styles.previewImage} resizeMode="contain" /> : <View style={styles.imageEmpty}><MaterialCommunityIcons name="image-off-outline" size={25} color={colors.textMuted} /><Text style={styles.hint}>No image selected</Text></View>}</View>

      <View style={styles.card}><View style={styles.toggleRow}><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>Featured product</Text><Text style={styles.toggleHint}>Highlight this item in admin merchandising.</Text></View><Switch value={values.isFeatured} onValueChange={(value) => update('isFeatured', value)} trackColor={{ false: colors.border, true: colors.infoBorder }} thumbColor={values.isFeatured ? colors.primary : colors.white} /></View><View style={styles.toggleDivider} /><View style={styles.toggleRow}><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>Active listing</Text><Text style={styles.toggleHint}>Allow this product to appear in the marketplace.</Text></View><Switch value={values.isActive} onValueChange={(value) => update('isActive', value)} trackColor={{ false: colors.border, true: colors.successBorder }} thumbColor={values.isActive ? colors.success : colors.white} /></View></View>

      {error ? <View style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.error}>{error}</Text></View> : null}
      <AppButton title={submitLabel} icon={submitLabel.toLowerCase().includes('save') ? 'content-save' : 'plus-circle'} loading={loading} onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 12 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 15, gap: 11, ...shadows.card },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 2 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  cardSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3, maxWidth: 280 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  dropdownWrap: { gap: 6 },
  dropdownAnchor: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dropdownPlaceholder: { color: colors.textMuted, fontWeight: '500' },
  twoCol: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  previewImage: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.cardAlt },
  imageEmpty: { minHeight: 110, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', gap: 6 },
  hint: { color: colors.textMuted, fontSize: 12 },
  toggleRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  toggleHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  toggleDivider: { height: 1, backgroundColor: colors.border },
  errorBox: { minHeight: 44, borderRadius: radius.md, backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.dangerBorder, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '700', flex: 1 }
});
