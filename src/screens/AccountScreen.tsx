import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorView } from '../components/StateViews';
import { AppButton } from '../components/AppButton';
import { api } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { CustomerStats, SavedAddress } from '../constants/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { logout } from '../redux/slices/authSlice';
import { RootStackParamList } from '../navigation/types';
import { formatINR } from '../utils/currency';
import { haptics } from '../utils/haptics';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export const AccountScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAppSelector((state) => state.auth);

  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Address state
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);

  // Address Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLine1, setFormLine1] = useState('');
  const [formLine2, setFormLine2] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formLandmark, setFormLandmark] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/orders/buyer/stats');
      setStats(res.data.data);
    } catch {
      // Fallback
    }
  }, []);

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setLoadingAddresses(true);
    try {
      const res = await api.get('/users/addresses');
      setAddresses(res.data.data || []);
    } catch (err: any) {
      console.error('Failed to load addresses:', err?.message);
    } finally {
      setLoadingAddresses(false);
    }
  }, [user]);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    await Promise.all([loadStats(), loadAddresses()]);

    setLoading(false);
    setRefreshing(false);
  }, [loadStats, loadAddresses]);

  useEffect(() => {
    if (user) {
      loadAll();
    } else {
      setLoading(false);
    }
  }, [user, loadAll]);

  const openAddressModal = (addr?: SavedAddress) => {
    haptics.lightImpact();
    if (addr) {
      setEditingAddress(addr);
      setFormName(addr.fullName || '');
      setFormPhone(addr.phone || '');
      setFormLine1(addr.addressLine1 || '');
      setFormLine2(addr.addressLine2 || '');
      setFormCity(addr.city || '');
      setFormState(addr.state || '');
      setFormPin(addr.postalCode || '');
      setFormLandmark(addr.landmark || '');
      setFormIsDefault(Boolean(addr.isDefault));
    } else {
      setEditingAddress(null);
      setFormName(user?.name || '');
      setFormPhone(user?.phone || '');
      setFormLine1('');
      setFormLine2('');
      setFormCity('');
      setFormState('');
      setFormPin('');
      setFormLandmark('');
      setFormIsDefault(addresses.length === 0);
    }
    setAddressModalVisible(true);
  };

  const handleSaveAddress = async () => {
    const trimmedName = formName.trim();
    const cleanPhone = formPhone.replace(/[^0-9]/g, '');
    const trimmedLine1 = formLine1.trim();
    const trimmedLine2 = formLine2.trim();
    const trimmedCity = formCity.trim();
    const trimmedState = formState.trim();
    const cleanPin = formPin.replace(/[^0-9]/g, '');
    const trimmedLandmark = formLandmark.trim();

    if (!trimmedName) {
      haptics.errorNotification();
      Alert.alert('Missing Name', 'Please enter recipient / contact name.');
      return;
    }
    if (cleanPhone.length < 10) {
      haptics.errorNotification();
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (!trimmedLine1) {
      haptics.errorNotification();
      Alert.alert('Missing Address Line 1', 'Please enter street / building address.');
      return;
    }
    if (!trimmedCity) {
      haptics.errorNotification();
      Alert.alert('Missing City', 'Please enter city.');
      return;
    }
    if (!trimmedState) {
      haptics.errorNotification();
      Alert.alert('Missing State', 'Please enter state.');
      return;
    }
    if (cleanPin.length !== 6) {
      haptics.errorNotification();
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit PIN code.');
      return;
    }

    setSavingAddress(true);
    haptics.mediumImpact();

    const payload = {
      fullName: trimmedName,
      phone: cleanPhone,
      addressLine1: trimmedLine1,
      addressLine2: trimmedLine2,
      city: trimmedCity,
      state: trimmedState,
      postalCode: cleanPin,
      country: 'India',
      landmark: trimmedLandmark,
      isDefault: formIsDefault
    };

    try {
      if (editingAddress?._id || editingAddress?.id) {
        const id = editingAddress._id || editingAddress.id;
        const res = await api.put(`/users/addresses/${id}`, payload);
        setAddresses(res.data.data?.addresses || []);
        toast.success('Address updated successfully');
      } else {
        const res = await api.post('/users/addresses', payload);
        setAddresses(res.data.data?.addresses || []);
        toast.success('New address saved to your account');
      }
      setAddressModalVisible(false);
    } catch (err: any) {
      haptics.errorNotification();
      toast.error(err?.response?.data?.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = (addr: SavedAddress) => {
    const id = addr._id || addr.id;
    if (!id) return;

    Alert.alert('Delete Address', `Remove "${addr.addressLine1}" from your saved addresses?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          haptics.selection();
          try {
            const res = await api.delete(`/users/addresses/${id}`);
            setAddresses(res.data.data || []);
            toast.info('Address removed');
          } catch (err: any) {
            haptics.errorNotification();
            toast.error(err?.response?.data?.message || 'Failed to delete address');
          }
        }
      }
    ]);
  };

  const handleSetDefault = async (addr: SavedAddress) => {
    const id = addr._id || addr.id;
    if (!id) return;

    haptics.selection();
    try {
      const res = await api.patch(`/users/addresses/${id}/default`);
      setAddresses(res.data.data || []);
      toast.success('Default delivery address updated');
    } catch (err: any) {
      haptics.errorNotification();
      toast.error(err?.response?.data?.message || 'Failed to update default address');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of AP Enterprises?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await dispatch(logout()).unwrap();
            toast.info('Signed out successfully');
            navigation.navigate('Home');
          } catch {
            toast.error('Failed to sign out');
          } finally {
            setLoggingOut(false);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account & Dashboard</Text>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {!user ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="account-lock-outline"
            title="Sign In Required"
            description="Please sign in or create an account to view your trade dashboard, order statistics, and saved supplies."
            actionLabel="Sign In"
            onAction={() => navigation.navigate('Login')}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(30, insets.bottom + 20) }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} colors={[colors.primary]} />
          }
        >
          {/* 1. CUSTOMER PROFILE CARD */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {user.name ? user.name.slice(0, 2).toUpperCase() : 'AP'}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.name}
                </Text>
                {user.isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.userEmail}>{user.email}</Text>
              {user.phone ? <Text style={styles.userPhone}>+91 {user.phone}</Text> : null}
              {user.companyName ? (
                <View style={styles.companyBadge}>
                  <MaterialCommunityIcons name="store-outline" size={13} color={colors.primary} />
                  <Text style={styles.companyText}>{user.companyName}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 2. REAL TRADE ORDER METRICS */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Business Order Activity</Text>
            <Text style={styles.sectionSubtitle}>Verified order metrics</Text>
          </View>

          {loading && !refreshing ? (
            <View style={styles.statsSkeletonGrid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.statSkeletonBox} />
              ))}
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {/* Total Orders */}
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} />
                </View>
                <Text style={styles.statNumber}>{stats?.totalOrders || 0}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>

              {/* In Transit */}
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#FFFBEB' }]}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={20} color="#D97706" />
                </View>
                <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats?.inTransitOrders || 0}</Text>
                <Text style={styles.statLabel}>Active / In-Transit</Text>
              </View>

              {/* Delivered */}
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialCommunityIcons name="check-decagram-outline" size={20} color={colors.success} />
                </View>
                <Text style={[styles.statNumber, { color: colors.success }]}>{stats?.completedOrders || 0}</Text>
                <Text style={styles.statLabel}>Delivered</Text>
              </View>

              {/* Total Spend */}
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#F5F3FF' }]}>
                  <MaterialCommunityIcons name="currency-inr" size={20} color="#7C3AED" />
                </View>
                <Text style={[styles.statNumber, { color: colors.navy }]}>
                  {formatINR(stats?.totalSpend || 0)}
                </Text>
                <Text style={styles.statLabel}>Total Procurement</Text>
              </View>
            </View>
          )}

          {/* 3. SAVED ADDRESSES SECTION */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithBtn}>
              <View>
                <Text style={styles.sectionTitle}>Saved Delivery Addresses</Text>
                <Text style={styles.sectionSubtitle}>Manage persistent wholesale delivery locations</Text>
              </View>
              <TouchableOpacity
                style={styles.addAddressHeaderBtn}
                onPress={() => openAddressModal()}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={colors.white} />
                <Text style={styles.addAddressHeaderBtnText}>Add New</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loadingAddresses ? (
            <View style={styles.addressLoadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.addressLoadingText}>Loading saved addresses...</Text>
            </View>
          ) : addresses.length === 0 ? (
            <View style={styles.emptyAddressCard}>
              <MaterialCommunityIcons name="map-marker-plus-outline" size={32} color={colors.primary} />
              <Text style={styles.emptyAddressTitle}>No Saved Addresses Yet</Text>
              <Text style={styles.emptyAddressSub}>
                Add your business, warehouse, or store delivery locations for fast 1-tap checkout.
              </Text>
              <TouchableOpacity
                style={styles.addFirstAddressBtn}
                onPress={() => openAddressModal()}
                activeOpacity={0.85}
              >
                <Ionicons name="location-outline" size={16} color={colors.white} />
                <Text style={styles.addFirstAddressBtnText}>Add Your First Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.addressListWrap}>
              {addresses.map((addr) => {
                const isDefault = Boolean(addr.isDefault);
                return (
                  <View key={addr._id || addr.id || Math.random().toString()} style={[styles.savedAddressCard, isDefault && styles.savedAddressCardDefault]}>
                    <View style={styles.savedAddressCardHeader}>
                      <View style={styles.addrNamePhoneCol}>
                        <View style={styles.addrNameRow}>
                          <Text style={styles.addrCardName}>{addr.fullName}</Text>
                          {isDefault ? (
                            <View style={styles.defaultBadge}>
                              <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.addrCardPhone}>+91 {addr.phone}</Text>
                      </View>

                      <View style={styles.addrCardActionsRow}>
                        <TouchableOpacity
                          style={styles.addrActionIconBtn}
                          onPress={() => openAddressModal(addr)}
                          hitSlop={6}
                        >
                          <Feather name="edit-2" size={15} color={colors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.addrActionIconBtn}
                          onPress={() => handleDeleteAddress(addr)}
                          hitSlop={6}
                        >
                          <Feather name="trash-2" size={15} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.addrCardLines}>
                      {addr.addressLine1}
                      {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                    </Text>
                    <Text style={styles.addrCardCityState}>
                      {addr.city}, {addr.state} - <Text style={styles.addrCardPin}>{addr.postalCode}</Text>
                    </Text>

                    {addr.landmark ? (
                      <View style={styles.addrLandmarkRow}>
                        <Ionicons name="navigate-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.addrLandmarkText}>Landmark: {addr.landmark}</Text>
                      </View>
                    ) : null}

                    {!isDefault ? (
                      <TouchableOpacity
                        style={styles.makeDefaultBtn}
                        onPress={() => handleSetDefault(addr)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.makeDefaultBtnText}>Set as Default Delivery Address</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {/* 4. QUICK ACTIONS GRID */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => navigation.navigate('Orders')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.actionTileTitle}>My Orders</Text>
              <Text style={styles.actionTileDesc}>Track & reorder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => navigation.navigate('Cart')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="cart-outline" size={24} color={colors.success} />
              </View>
              <Text style={styles.actionTileTitle}>Wholesale Cart</Text>
              <Text style={styles.actionTileDesc}>Review items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => navigation.navigate('Wishlist')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="heart-outline" size={24} color={colors.danger} />
              </View>
              <Text style={styles.actionTileTitle}>Wishlist</Text>
              <Text style={styles.actionTileDesc}>Saved products</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => navigation.navigate('Catalog')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#FFFBEB' }]}>
                <MaterialCommunityIcons name="storefront-outline" size={24} color="#D97706" />
              </View>
              <Text style={styles.actionTileTitle}>Quick Order</Text>
              <Text style={styles.actionTileDesc}>Explore catalog</Text>
            </TouchableOpacity>
          </View>

          {/* 5. ACCOUNT SETTINGS & SIGN OUT */}
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                haptics.lightImpact();
                navigation.navigate('Notifications');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                <Text style={styles.menuLabel}>Notification Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleSignOut}
              disabled={loggingOut}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
                <Text style={[styles.menuLabel, { color: colors.danger }]}>Sign Out</Text>
              </View>
              {loggingOut ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.danger} />
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ADD / EDIT ADDRESS MODAL */}
      <Modal
        visible={addressModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!savingAddress) setAddressModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingAddress ? 'Edit Delivery Address' : 'Add Delivery Address'}
                </Text>
                <Text style={styles.modalSub}>Saved to your persistent wholesale account</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAddressModalVisible(false)}
                disabled={savingAddress}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Contact / Business Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Ramesh Traders / Aniket"
                  placeholderTextColor={colors.textMuted}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mobile Number *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={formPhone}
                  onChangeText={setFormPhone}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Address Line 1 (Shop/Flat/Street) *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="House/Shop no., Building, Street"
                  placeholderTextColor={colors.textMuted}
                  value={formLine1}
                  onChangeText={setFormLine1}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Address Line 2 (Area/Locality)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Locality, Sector, Market"
                  placeholderTextColor={colors.textMuted}
                  value={formLine2}
                  onChangeText={setFormLine2}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>City *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="City"
                    placeholderTextColor={colors.textMuted}
                    value={formCity}
                    onChangeText={setFormCity}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>State *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="State"
                    placeholderTextColor={colors.textMuted}
                    value={formState}
                    onChangeText={setFormState}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Postal PIN Code *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="6-digit PIN"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={formPin}
                    onChangeText={setFormPin}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Landmark (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Near landmark"
                    placeholderTextColor={colors.textMuted}
                    value={formLandmark}
                    onChangeText={setFormLandmark}
                  />
                </View>
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>Set as Default Address</Text>
                  <Text style={styles.switchSub}>Use this address automatically during checkout</Text>
                </View>
                <Switch
                  value={formIsDefault}
                  onValueChange={setFormIsDefault}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.modalBtnRow}>
                <AppButton
                  title={savingAddress ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
                  icon="check"
                  variant="primary"
                  fullWidth
                  loading={savingAddress}
                  onPress={handleSaveAddress}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingVertical: 12,
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
    fontSize: 17,
    fontWeight: '900',
    color: colors.navy
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    padding: 16,
    gap: 14
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    ...shadows.card
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900'
  },
  profileInfo: {
    flex: 1,
    gap: 3
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  userName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.navy,
    flexShrink: 1
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success
  },
  userEmail: {
    fontSize: 12.5,
    color: colors.textSecondary
  },
  userPhone: {
    fontSize: 12,
    color: colors.textMuted
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2
  },
  companyText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary
  },
  sectionHeaderRow: {
    marginTop: 6
  },
  sectionTitleWithBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.navy
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1
  },
  addAddressHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill
  },
  addAddressHeaderBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  statCard: {
    width: '48.3%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    ...shadows.card
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  statsSkeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  statSkeletonBox: {
    width: '48.3%',
    height: 100,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  addressLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  addressLoadingText: {
    fontSize: 12.5,
    color: colors.textMuted,
    fontWeight: '600'
  },
  emptyAddressCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.card
  },
  emptyAddressTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.navy,
    marginTop: 4
  },
  emptyAddressSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12
  },
  addFirstAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    marginTop: 6
  },
  addFirstAddressBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800'
  },
  addressListWrap: {
    gap: 10
  },
  savedAddressCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    ...shadows.card
  },
  savedAddressCardDefault: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.cardAlt
  },
  savedAddressCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  addrNamePhoneCol: {
    flex: 1,
    paddingRight: 8
  },
  addrNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  addrCardName: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.navy
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary
  },
  addrCardPhone: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2
  },
  addrCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  addrActionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addrCardLines: {
    fontSize: 12.5,
    color: colors.text,
    lineHeight: 18
  },
  addrCardCityState: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  addrCardPin: {
    fontWeight: '800',
    color: colors.navy
  },
  addrLandmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2
  },
  addrLandmarkText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic'
  },
  makeDefaultBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  makeDefaultBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  actionTile: {
    width: '48.3%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    ...shadows.card
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  actionTileTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.navy
  },
  actionTileDesc: {
    fontSize: 11,
    color: colors.textMuted
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    overflow: 'hidden',
    ...shadows.card
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    padding: 20,
    gap: 14
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.navy
  },
  modalSub: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalScroll: {
    paddingVertical: 6
  },
  formGroup: {
    marginBottom: 12,
    gap: 5
  },
  formRow: {
    flexDirection: 'row',
    gap: 10
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  formInput: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: colors.text
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    marginBottom: 14
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  switchSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1
  },
  modalBtnRow: {
    paddingBottom: 24
  }
});
