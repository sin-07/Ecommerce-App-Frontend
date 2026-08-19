import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView
} from '@gorhom/bottom-sheet';
import { Menu, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Product } from '../constants/types';
import { colors } from '../constants/theme';
import { AppButton } from './AppButton';

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

export const EditProductBottomSheet: React.FC<Props> = ({
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
  const [menuVisible, setMenuVisible] = useState(false);
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
    if (!visible || !product) return;
    setName(product.name || '');
    setPrice(String(product.price ?? ''));
    setStock(String(product.stock ?? ''));
    setCategory(product.category || '');
    setError('');
  }, [visible, product]);

  const parsedPrice = useMemo(() => Number(price), [price]);
  const parsedStock = useMemo(() => Number(stock), [stock]);

  const validate = () => {
    if (!name.trim() || !category.trim() || !price.trim() || !stock.trim()) {
      setError('All fields are required.');
      return false;
    }

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Enter a valid price greater than 0.');
      return false;
    }

    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      setError('Enter a valid stock (0 or more).');
      return false;
    }

    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    await onSave({
      name: name.trim(),
      price: parsedPrice,
      stock: parsedStock,
      category: category.trim()
    });
  };

  const hasChanges =
    !!product &&
    (name.trim() !== (product.name || '').trim() ||
      parsedPrice !== Number(product.price) ||
      parsedStock !== Number(product.stock) ||
      category.trim() !== (product.category || '').trim());

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.56} pressBehavior="close" />
    ),
    []
  );

  const onSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        setMenuVisible(false);
        onClose();
      }
    },
    [onClose]
  );

  const renderFooter = useCallback(
    (props: any) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom + 8}>
        <View style={styles.footer}>
          <View style={styles.actionHalf}>
            <AppButton title="Cancel" icon="close" variant="secondary" onPress={() => sheetRef.current?.dismiss()} />
          </View>
          <View style={styles.actionHalf}>
            <AppButton
              title="Save"
              icon="content-save"
              loading={saving}
              disabled={!hasChanges || saving}
              onPress={handleSave}
            />
          </View>
        </View>
      </BottomSheetFooter>
    ),
    [insets.bottom, hasChanges, saving, handleSave]
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 22 : 0}
          style={styles.keyboardWrap}
        >
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
              <Text style={styles.inputLabel}>Price</Text>
              <TextInput
                mode="outlined"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="Enter price"
                outlineStyle={[styles.inputOutline, priceFocused && styles.inputOutlineFocused]}
                style={styles.input}
                textColor={colors.text}
                onFocus={() => setPriceFocused(true)}
                onBlur={() => setPriceFocused(false)}
                theme={{ colors: { primary: '#3f86ff', outline: '#2a4a79', background: '#12284a' } }}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Stock</Text>
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

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Category</Text>
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <TouchableOpacity style={styles.dropdownAnchor} activeOpacity={0.9} onPress={() => setMenuVisible(true)}>
                    <Text style={[styles.dropdownText, !category && styles.dropdownPlaceholder]}>{category || 'Select category'}</Text>
                    <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                }
              >
                {categories.map((cat) => (
                  <Menu.Item
                    key={cat}
                    title={cat}
                    onPress={() => {
                      setCategory(cat);
                      setMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </BottomSheetScrollView>
        </KeyboardAvoidingView>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: '#0f1f3b',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#22406e',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10
  },
  handleIndicator: {
    backgroundColor: '#5677ab',
    width: 56,
    height: 5
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  keyboardWrap: {
    flex: 1
  },
  title: {
    color: '#f3f8ff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    paddingHorizontal: 2
  },
  form: {
    gap: 12,
    paddingBottom: 12
  },
  inputWrap: {
    gap: 6
  },
  inputLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13
  },
  input: {
    backgroundColor: '#12284a'
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a4a79'
  },
  inputOutlineFocused: {
    borderColor: '#3f86ff'
  },
  dropdownAnchor: {
    backgroundColor: '#12284a',
    borderWidth: 1,
    borderColor: '#2a4a79',
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dropdownText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600'
  },
  dropdownPlaceholder: {
    color: colors.textMuted,
    fontWeight: '500'
  },
  error: {
    color: '#ff6b6b',
    fontWeight: '600',
    fontSize: 12
  },
  footer: {
    backgroundColor: '#0f1f3b',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#22406e',
    flexDirection: 'row',
    gap: 10
  },
  actionHalf: {
    flex: 1
  }
});
