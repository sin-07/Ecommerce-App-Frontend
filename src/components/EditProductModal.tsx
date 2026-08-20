import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView
} from '@gorhom/bottom-sheet';
import { TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Product } from '../constants/types';
import { colors, radius, shadows } from '../constants/theme';
import { AppButton } from './AppButton';
import { AnimatedDropdown } from './AnimatedDropdown';

type EditPayload = {
  name: string;
  price: number;
  stock: number;
  category: string;
};

type Props = {
  visible: boolean;
  product: Product | null;
  categories: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: EditPayload) => void | Promise<void>;
};

export const EditProductModal: React.FC<Props> = ({
  visible,
  product,
  categories,
  saving = false,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [priceFocused, setPriceFocused] = useState(false);
  const [stockFocused, setStockFocused] = useState(false);
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['70%'], []);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (!product) {
      setName('');
      setPrice('');
      setStock('');
      setCategory('');
      setError('');
      return;
    }

    setName(product.name || '');
    setPrice(String(product.price ?? ''));
    setStock(String(product.stock ?? ''));
    setCategory(product.category || (categories[0] ?? 'Beverages'));
    setError('');
  }, [product, categories]);

  const hasChanges = useMemo(() => {
    if (!product) return false;
    const numericPrice = Number(price);
    const numericStock = Number(stock);
    return (
      name.trim() !== product.name ||
      numericPrice !== product.price ||
      numericStock !== product.stock ||
      category !== product.category
    );
  }, [name, price, stock, category, product]);

  const validate = () => {
    if (!name.trim()) return 'Product name is required';
    if (!price.trim()) return 'Price is required';
    const numPrice = Number(price);
    if (Number.isNaN(numPrice) || numPrice < 0) return 'Enter a valid price';
    if (!stock.trim()) return 'Stock is required';
    const numStock = Number(stock);
    if (Number.isNaN(numStock) || numStock < 0) return 'Enter a valid stock quantity';
    if (!category.trim()) return 'Category is required';
    return null;
  };

  const handleSave = useCallback(async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setError('');
    await onSave({
      name: name.trim(),
      price: Number(price),
      stock: Number(stock),
      category: category.trim()
    });
  }, [name, price, stock, category, onSave]);

  const onSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const renderFooter = useCallback(
    (props: any) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <View style={styles.footer}>
          <View style={styles.footerActions}>
            <View style={styles.footerBtn}>
              <AppButton title="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
            </View>
            <View style={styles.footerBtn}>
              <AppButton
                title={saving ? 'Saving...' : 'Save Changes'}
                icon="content-save-outline"
                variant="primary"
                loading={saving}
                disabled={!hasChanges || saving}
                onPress={handleSave}
              />
            </View>
          </View>
        </View>
      </BottomSheetFooter>
    ),
    [insets.bottom, hasChanges, saving, handleSave, onClose]
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={onSheetChange}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      enablePanDownToClose
      animateOnMount
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBg}
    >
      <BottomSheetView style={styles.container}>
        <Text style={styles.title}>Edit Product</Text>

        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Product Name</Text>
            <TextInput
              mode="outlined"
              value={name}
              onChangeText={setName}
              placeholder="Enter product name"
              outlineStyle={[styles.inputOutline, nameFocused && styles.inputOutlineFocused]}
              style={styles.input}
              textColor={colors.text}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              theme={{ colors: { primary: '#3f86ff', outline: '#2a4a79', background: '#12284a' } }}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Price (₹)</Text>
            <TextInput
              mode="outlined"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="Enter price in ₹"
              outlineStyle={[styles.inputOutline, priceFocused && styles.inputOutlineFocused]}
              style={styles.input}
              textColor={colors.text}
              onFocus={() => setPriceFocused(true)}
              onBlur={() => setPriceFocused(false)}
              theme={{ colors: { primary: '#3f86ff', outline: '#2a4a79', background: '#12284a' } }}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Stock Quantity</Text>
            <TextInput
              mode="outlined"
              value={stock}
              onChangeText={setStock}
              keyboardType="numeric"
              placeholder="Enter stock"
              outlineStyle={[styles.inputOutline, stockFocused && styles.inputOutlineFocused]}
              style={styles.input}
              textColor={colors.text}
              onFocus={() => setStockFocused(true)}
              onBlur={() => setStockFocused(false)}
              theme={{ colors: { primary: '#3f86ff', outline: '#2a4a79', background: '#12284a' } }}
            />
          </View>

          <AnimatedDropdown
            label="Category"
            selectedValue={category}
            options={categories.length ? categories : ['Beverages', 'Eggs', 'Existing Products']}
            onSelect={(cat) => setCategory(cat)}
            placeholder="Select category"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20
  },
  sheetBg: {
    backgroundColor: colors.card
  },
  handleIndicator: {
    backgroundColor: colors.border,
    width: 44,
    height: 4
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12
  },
  form: {
    gap: 12,
    paddingTop: 4
  },
  inputWrap: {
    gap: 6
  },
  inputLabel: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '800'
  },
  input: {
    backgroundColor: colors.cardAlt,
    fontSize: 14,
    fontWeight: '600'
  },
  inputOutline: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1.5
  },
  inputOutlineFocused: {
    borderColor: colors.primary
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10
  },
  footerBtn: {
    flex: 1
  }
});
