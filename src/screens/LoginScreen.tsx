import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const logoSource = require('../../assets/Ap-Enterprises.jpeg');
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BeverageLoader } from '../components/BeverageLoader';
import { DeveloperNoteModal } from '../components/DeveloperNoteModal';
import { colors, radius, shadows } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { clearPendingAction, login } from '../redux/slices/authSlice';
import { addCartItem } from '../redux/slices/cartSlice';
import { toggleWishlist } from '../redux/slices/wishlistSlice';
import { RootStackParamList } from '../navigation/types';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { loading, error, pendingAction } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [developerNoteVisible, setDeveloperNoteVisible] = useState(false);

  const passwordInputRef = useRef<NativeTextInput | null>(null);

  const handleLogin = async () => {
    setValidationError('');
    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (!cleanEmail) {
      setValidationError('Please enter your business email');
      toast.show('Email address is required', 'error');
      return;
    }

    if (!emailPattern.test(cleanEmail)) {
      setValidationError('Please enter a valid email address');
      toast.show('Invalid email format', 'error');
      return;
    }

    if (!cleanPassword) {
      setValidationError('Please enter your account password');
      toast.show('Password is required', 'error');
      return;
    }

    setSigningIn(true);
    try {
      const session = await dispatch(login({ email: cleanEmail, password: cleanPassword })).unwrap();
      toast.show('Welcome to AP Enterprises! ✓', 'success', 'Signed In');

      // Fulfill pending action if one exists for buyer
      if (pendingAction && session?.user?.role === 'buyer') {
        const action = pendingAction;
        dispatch(clearPendingAction());

        if (action.type === 'ADD_TO_CART') {
          try {
            await dispatch(addCartItem({ productId: action.productId, quantity: action.quantity || 1 })).unwrap();
            toast.show(`Added ${action.product?.name || 'product'} to cart ✓`, 'success');
          } catch {}
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Home');
          }
          return;
        }

        if (action.type === 'BUY_NOW') {
          try {
            await dispatch(addCartItem({ productId: action.productId, quantity: action.quantity || 1 })).unwrap();
          } catch {}
          navigation.navigate('Cart');
          return;
        }

        if (action.type === 'WISHLIST' && action.product) {
          dispatch(toggleWishlist(action.product));
          toast.show(`Added ${action.product.name} to wishlist ❤️`, 'success');
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Home');
          }
          return;
        }
      }

      // Default role-based routing
      if (session?.user?.role === 'admin') {
        navigation.navigate('AdminDashboard');
      } else if (session?.user?.role === 'seller') {
        navigation.navigate('SellerDashboard');
      } else {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Home');
        }
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Login failed. Please verify your credentials.';
      setValidationError(msg);
      toast.show(msg, 'error');
    } finally {
      setSigningIn(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      'For wholesale account security, password resets are processed by AP Enterprises administration. Please contact support@apenterprises.com or register a new verified account.',
      [{ text: 'OK' }]
    );
  };

  const displayError = validationError || error;
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <BeverageLoader visible={signingIn} mode="auth" title="AP Enterprises" subtitle="Verifying your wholesale credentials..." />

        {/* TOP SAFE-AREA BAR / BACK BUTTON */}
        {navigation.canGoBack() ? (
          <View style={styles.topBar}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={8}
              accessibilityLabel="Back to catalog"
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color={colors.primary} />
              <Text style={styles.backButtonText}>Back to Catalog</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(28, insets.bottom + 20) }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* BRAND HEADER */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.brandName}>AP Enterprises</Text>
          <View style={styles.taglinePill}>
            <Text style={styles.taglineText}>PREMIUM B2B BEVERAGE SUPPLY</Text>
          </View>
          <Text style={styles.welcomeText}>Sign in to your wholesale account</Text>
        </View>

        {/* LOGIN CARD */}
        <View style={styles.card}>
          {/* EMAIL FIELD */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Business Email</Text>
            <View
              style={[
                styles.inputContainer,
                emailFocused && styles.inputFocused,
                Boolean(displayError) && styles.inputError
              ]}
            >
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color={emailFocused ? colors.primary : colors.textMuted}
              />
              <NativeTextInput
                style={styles.textInput}
                placeholder="name@business.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setValidationError('');
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                accessibilityLabel="Business email input"
              />
            </View>
          </View>

          {/* PASSWORD FIELD */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>Password</Text>
              <Pressable onPress={handleForgotPassword} hitSlop={8}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>
            <View
              style={[
                styles.inputContainer,
                passwordFocused && styles.inputFocused,
                Boolean(displayError) && styles.inputError
              ]}
            >
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color={passwordFocused ? colors.primary : colors.textMuted}
              />
              <NativeTextInput
                ref={passwordInputRef}
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Enter password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setValidationError('');
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                accessibilityLabel="Password input"
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={8}
                style={styles.eyeButton}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {/* ERROR DISPLAY */}
          {displayError ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {/* SIGN IN BUTTON */}
          <Pressable
            onPress={handleLogin}
            disabled={loading || signingIn}
            style={({ pressed }) => [
              styles.loginButton,
              (loading || signingIn) && styles.buttonDisabled,
              pressed && { backgroundColor: colors.primaryPressed }
            ]}
          >
            <MaterialCommunityIcons name="login" size={20} color={colors.white} />
            <Text style={styles.loginButtonText}>
              {signingIn || loading ? 'Signing In…' : 'Sign In to Portal'}
            </Text>
          </Pressable>

          {/* DEMO ACCOUNTS HINT */}
          <View style={styles.demoBox}>
            <View style={styles.demoHeader}>
              <MaterialCommunityIcons name="information-outline" size={15} color={colors.primary} />
              <Text style={styles.demoTitle}>Wholesale Direct Access</Text>
            </View>
            <Text style={styles.demoText}>
              Registered buyer & distributor portal for bulk beverage orders.
            </Text>
          </View>
        </View>

        {/* REGISTER FOOTER */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New to AP Enterprises beverage supply?</Text>
          <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
            <Text style={styles.registerLink}>Register Account</Text>
          </Pressable>
        </View>

        {/* DEVELOPER NOTE PILL */}
        <View style={styles.devNoteRow}>
          <Pressable
            onPress={() => setDeveloperNoteVisible(true)}
            style={({ pressed }) => [styles.devNotePill, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="code-tags" size={14} color={colors.primary} />
            <Text style={styles.devNotePillText}>Trial Release • Developer Note</Text>
          </Pressable>
        </View>
      </ScrollView>

      <DeveloperNoteModal
        visible={developerNoteVisible}
        onClose={() => setDeveloperNoteVisible(false)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  flex: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...shadows.floating
  },
  logoImage: {
    width: '100%',
    height: '100%'
  },
  brandName: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: -0.5
  },
  taglinePill: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  taglineText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.8
  },
  welcomeText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 18,
    ...shadows.card
  },
  inputGroup: {
    gap: 6
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 52,
    gap: 10
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.card
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: colors.text,
    paddingVertical: 0
  },
  eyeButton: {
    padding: 4
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 10,
    gap: 8
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: '600'
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4
  },
  buttonDisabled: {
    opacity: 0.6
  },
  loginButtonText: {
    color: colors.white,
    fontSize: 15.5,
    fontWeight: '900'
  },
  demoBox: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 12,
    gap: 4
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.navy
  },
  demoText: {
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 13
  },
  registerLink: {
    color: colors.primary,
    fontSize: 13.5,
    fontWeight: '900'
  },
  devNoteRow: {
    alignItems: 'center',
    marginTop: 20
  },
  devNotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder
  },
  devNotePillText: {
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: '800'
  }
});
