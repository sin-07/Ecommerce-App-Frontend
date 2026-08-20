import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View
} from 'react-native';

const logoSource = require('../../assets/Ap-Enterprises.jpeg');
import { SafeAreaView } from 'react-native-safe-area-context';
import { OtpInput, OtpInputHandle } from '../components/OtpInput';
import { BeverageLoader } from '../components/BeverageLoader';
import { api } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { clearPendingAction, register, verifyOtp } from '../redux/slices/authSlice';
import { addCartItem } from '../redux/slices/cartSlice';
import { toggleWishlist } from '../redux/slices/wishlistSlice';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[6-9]\d{9}$|^[+0-9\s\-()]{10,15}$/;

const maskEmail = (value: string) => {
  const [name, domain] = value.trim().split('@');
  if (!name || !domain) return value;
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(4, name.length - 2)))}@${domain}`;
};

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { loading, pendingAction } = useAppSelector((state) => state.auth);

  // Form State - all fields start EMPTY initially
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  // OTP State
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Refs
  const scrollViewRef = useRef<ScrollView | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const otpInputRef = useRef<OtpInputHandle | null>(null);
  const otpRequestLock = useRef(false);
  const submitLock = useRef(false);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true
    }).start();
  }, [entrance]);

  // Resend Countdown Timer
  useEffect(() => {
    if (!seconds) return;
    const timer = setInterval(() => setSeconds((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 6,
      match: password.length > 0 && password === confirmPassword
    }),
    [password, confirmPassword]
  );

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setOtpSent(false);
    setOtpVerified(false);
    setOtp('');
    setSeconds(0);
    setFieldErrors((curr) => ({ ...curr, email: '' }));
  };

  // Inline Validator for specific fields
  const validateField = (fieldName: string, value: string) => {
    let err = '';
    if (fieldName === 'name') {
      if (!value.trim()) err = 'Full name is required';
      else if (value.trim().length < 2) err = 'Full name must be at least 2 characters';
    } else if (fieldName === 'company') {
      if (!value.trim()) err = 'Company / Store name is required';
      else if (value.trim().length < 2) err = 'Company / Store name must be at least 2 characters';
    } else if (fieldName === 'email') {
      if (!value.trim()) err = 'Business email is required';
      else if (!emailPattern.test(value.trim())) err = 'Enter a valid business email address';
    } else if (fieldName === 'phone') {
      if (!value.trim()) err = 'Contact phone number is required';
      else if (!phonePattern.test(value.trim().replace(/\s/g, ''))) err = 'Enter a valid 10-digit mobile number';
    } else if (fieldName === 'password') {
      if (!value) err = 'Password is required';
      else if (value.length < 6) err = 'Password must be at least 6 characters';
    } else if (fieldName === 'confirmPassword') {
      if (!value) err = 'Please confirm your password';
      else if (value !== password) err = 'Passwords do not match';
    }
    setFieldErrors((curr) => ({ ...curr, [fieldName]: err }));
    return !err;
  };

  // Full form validation
  const validateForm = () => {
    const next: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      next.name = 'Full name must be at least 2 characters';
    }

    if (!companyName.trim() || companyName.trim().length < 2) {
      next.company = 'Company / Store name is required';
    }

    if (!email.trim() || !emailPattern.test(email.trim())) {
      next.email = 'Enter a valid business email address';
    }

    if (!phone.trim() || !phonePattern.test(phone.trim().replace(/\s/g, ''))) {
      next.phone = 'Enter a valid 10-digit mobile phone number';
    }

    if (!password || password.length < 6) {
      next.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword || password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match';
    }

    if (!otp || otp.length !== 6) {
      next.otp = 'Enter the 6-digit verification code';
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const scrollToInput = (yOffset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 100);
  };

  const requestOtp = async () => {
    setError('');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !emailPattern.test(cleanEmail)) {
      setFieldErrors((curr) => ({ ...curr, email: 'Enter a valid business email first' }));
      toast.show('Please enter a valid email address first.', 'error');
      scrollToInput(180);
      return;
    }

    if (seconds > 0 || otpLoading || otpRequestLock.current) return;
    otpRequestLock.current = true;
    setOtpLoading(true);

    try {
      const response = await api.post('/auth/request-otp', { email: cleanEmail });
      setOtpSent(true);
      setOtpVerified(false);
      setOtp('');
      setSeconds(45);
      toast.show(`Verification code sent to ${maskEmail(cleanEmail)}`, 'success', 'Code Sent');
      scrollToInput(300);
    } catch (requestError: any) {
      const status = requestError?.response?.status;
      const message =
        status === 409
          ? 'This email is already registered. Please log in.'
          : status === 429
          ? 'Please wait before requesting another code.'
          : requestError?.response?.data?.message || 'Unable to send verification email. Please try again.';
      setError(message);
      toast.show(message, 'error');
    } finally {
      otpRequestLock.current = false;
      setOtpLoading(false);
    }
  };

  const verifyCode = async () => {
    if (otp.length !== 6 || otpVerifying || otpVerified) return;
    setError('');
    setOtpVerifying(true);

    try {
      await dispatch(verifyOtp({ email: email.trim().toLowerCase(), otp })).unwrap();
      setOtpVerified(true);
      otpInputRef.current?.success();
      toast.show('Email verified successfully ✓', 'success', 'Verified');
      Keyboard.dismiss();
    } catch (verificationError: any) {
      const message = String(verificationError || 'The verification code is incorrect.');
      setOtpVerified(false);
      otpInputRef.current?.shake();
      setError(message);
      toast.show(message, 'error', 'Invalid Code');
    } finally {
      setOtpVerifying(false);
    }
  };

  const submitRegistration = async () => {
    if (submitLock.current || loading || submitting) return;
    setError('');

    if (!validateForm()) {
      toast.show('Please fill in all mandatory fields correctly.', 'error');
      return;
    }

    if (!otpVerified) {
      setError('Please verify your email address with the 6-digit code before registering.');
      otpInputRef.current?.shake();
      toast.show('Verify your email with the 6-digit code first.', 'error');
      scrollToInput(300);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);

    try {
      const session = await dispatch(
        register({
          name: name.trim(),
          companyName: companyName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          role: 'buyer',
          otp
        })
      ).unwrap();
      toast.show('Wholesale account created successfully! ✓', 'success', 'Welcome!');

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

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (registrationError: any) {
      const message = String(registrationError || 'Something went wrong. Please try again.');
      setError(message);
      toast.show(message, 'error');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
      >
        <BeverageLoader
          visible={submitting}
          mode="auth"
          title="AP Enterprises"
          subtitle="Setting up your wholesale account..."
        />

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
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.mainCard, { opacity: entrance }]}>
            {/* HEADER */}
            <View style={styles.header}>
            <View style={styles.brandIconWrap}>
              <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>AP ENTERPRISES</Text>
            </View>
            <Text style={styles.title}>Wholesale Registration</Text>
            <Text style={styles.subtitle}>
              Beverages • Farm Fresh Eggs • Wholesale Supplies
            </Text>
          </View>

          {/* ERROR ALERT */}
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          {/* FORM FIELDS */}
          <View style={styles.formSection}>
            {/* 1. FULL NAME */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'name' && styles.inputFocused,
                  Boolean(fieldErrors.name) && styles.inputError
                ]}
              >
                <MaterialCommunityIcons
                  name="account-outline"
                  size={20}
                  color={focusedField === 'name' ? colors.primary : colors.textMuted}
                />
                <NativeTextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    if (fieldErrors.name) validateField('name', v);
                  }}
                  onFocus={() => {
                    setFocusedField('name');
                    scrollToInput(40);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    validateField('name', name);
                  }}
                  autoCapitalize="words"
                  accessibilityLabel="Full name"
                />
              </View>
              {fieldErrors.name ? <Text style={styles.errorText}>{fieldErrors.name}</Text> : null}
            </View>

            {/* 2. COMPANY / STORE NAME */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Company / Store Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'company' && styles.inputFocused,
                  Boolean(fieldErrors.company) && styles.inputError
                ]}
              >
                <MaterialCommunityIcons
                  name="domain"
                  size={20}
                  color={focusedField === 'company' ? colors.primary : colors.textMuted}
                />
                <NativeTextInput
                  style={styles.input}
                  placeholder="Enter company or store name"
                  placeholderTextColor={colors.textMuted}
                  value={companyName}
                  onChangeText={(v) => {
                    setCompanyName(v);
                    if (fieldErrors.company) validateField('company', v);
                  }}
                  onFocus={() => {
                    setFocusedField('company');
                    scrollToInput(100);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    validateField('company', companyName);
                  }}
                  accessibilityLabel="Company or store name"
                />
              </View>
              {fieldErrors.company ? <Text style={styles.errorText}>{fieldErrors.company}</Text> : null}
            </View>

            {/* 3. BUSINESS EMAIL WITH OTP ACTION */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Business Email <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'email' && styles.inputFocused,
                  Boolean(fieldErrors.email) && styles.inputError,
                  otpVerified && styles.inputVerified
                ]}
              >
                <MaterialCommunityIcons
                  name="email-outline"
                  size={20}
                  color={
                    otpVerified
                      ? colors.success
                      : focusedField === 'email'
                      ? colors.primary
                      : colors.textMuted
                  }
                />
                <NativeTextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="buyer@business.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!otpVerified}
                  onFocus={() => {
                    setFocusedField('email');
                    scrollToInput(160);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    validateField('email', email);
                  }}
                  accessibilityLabel="Business email"
                />
                {!otpVerified ? (
                  <Pressable
                    onPress={requestOtp}
                    disabled={otpLoading || seconds > 0}
                    style={[styles.otpSendBtn, (otpLoading || seconds > 0) && styles.otpSendBtnDisabled]}
                  >
                    {otpLoading ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.otpSendBtnText}>
                        {seconds > 0 ? `${seconds}s` : otpSent ? 'Resend' : 'Send Code'}
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.verifiedBadge}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                )}
              </View>
              {fieldErrors.email ? <Text style={styles.errorText}>{fieldErrors.email}</Text> : null}
            </View>

            {/* 6-DIGIT OTP VERIFICATION BLOCK */}
            {otpSent && !otpVerified ? (
              <View style={styles.otpSection}>
                <View style={styles.otpHeaderRow}>
                  <Text style={styles.otpSectionTitle}>Enter 6-Digit Verification Code</Text>
                  {seconds > 0 ? (
                    <Text style={styles.resendTimerText}>Resend in {seconds}s</Text>
                  ) : (
                    <Pressable onPress={requestOtp} hitSlop={6}>
                      <Text style={styles.resendActiveText}>Resend Code</Text>
                    </Pressable>
                  )}
                </View>

                <OtpInput
                  ref={otpInputRef}
                  value={otp}
                  onChange={(code) => {
                    setOtp(code);
                    setFieldErrors((c) => ({ ...c, otp: '' }));
                  }}
                  onComplete={() => verifyCode()}
                  hasError={Boolean(fieldErrors.otp)}
                />

                {fieldErrors.otp ? <Text style={styles.errorText}>{fieldErrors.otp}</Text> : null}

                <Pressable
                  onPress={verifyCode}
                  disabled={otp.length !== 6 || otpVerifying || otpVerified}
                  style={[
                    styles.verifyButton,
                    (otp.length !== 6 || otpVerified) && styles.buttonDisabled
                  ]}
                >
                  {otpVerifying ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <MaterialCommunityIcons
                      name="shield-check-outline"
                      size={18}
                      color={colors.white}
                    />
                  )}
                  <Text style={styles.verifyButtonText}>
                    {otpVerifying ? 'Verifying Code…' : 'Verify Email Code'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* 4. CONTACT PHONE NUMBER */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Contact Phone Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'phone' && styles.inputFocused,
                  Boolean(fieldErrors.phone) && styles.inputError
                ]}
              >
                <MaterialCommunityIcons
                  name="phone-outline"
                  size={20}
                  color={focusedField === 'phone' ? colors.primary : colors.textMuted}
                />
                <NativeTextInput
                  style={styles.input}
                  placeholder="Enter 10-digit mobile number (e.g. 9876543210)"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v);
                    if (fieldErrors.phone) validateField('phone', v);
                  }}
                  keyboardType="phone-pad"
                  onFocus={() => {
                    setFocusedField('phone');
                    scrollToInput(360);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    validateField('phone', phone);
                  }}
                  accessibilityLabel="Contact phone"
                />
              </View>
              {fieldErrors.phone ? <Text style={styles.errorText}>{fieldErrors.phone}</Text> : null}
            </View>

            {/* 5. PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Password <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'password' && styles.inputFocused,
                  Boolean(fieldErrors.password) && styles.inputError
                ]}
              >
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={20}
                  color={focusedField === 'password' ? colors.primary : colors.textMuted}
                />
                <NativeTextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (fieldErrors.password) validateField('password', v);
                  }}
                  secureTextEntry={!showPassword}
                  onFocus={() => {
                    setFocusedField('password');
                    scrollToInput(420);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    validateField('password', password);
                  }}
                  accessibilityLabel="Password"
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
              {fieldErrors.password ? (
                <Text style={styles.errorText}>{fieldErrors.password}</Text>
              ) : null}
            </View>

            {/* 6. CONFIRM PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Confirm Password <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'confirmPassword' && styles.inputFocused,
                  Boolean(fieldErrors.confirmPassword) && styles.inputError,
                  passwordChecks.match && styles.inputVerified
                ]}
              >
                <MaterialCommunityIcons
                  name="lock-check-outline"
                  size={20}
                  color={
                    passwordChecks.match
                      ? colors.success
                      : focusedField === 'confirmPassword'
                      ? colors.primary
                      : colors.textMuted
                  }
                />
                <NativeTextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Re-enter password to confirm"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    if (fieldErrors.confirmPassword) validateField('confirmPassword', v);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  onFocus={() => {
                    setFocusedField('confirmPassword');
                    scrollToInput(480);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    validateField('confirmPassword', confirmPassword);
                  }}
                  accessibilityLabel="Confirm password"
                />
                <Pressable
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  <MaterialCommunityIcons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
              {fieldErrors.confirmPassword ? (
                <Text style={styles.errorText}>{fieldErrors.confirmPassword}</Text>
              ) : null}
            </View>
          </View>

          {/* SUBMIT BUTTON */}
          <Pressable
            onPress={submitRegistration}
            disabled={submitting || loading}
            style={({ pressed }) => [
              styles.submitBtn,
              (submitting || loading) && styles.buttonDisabled,
              pressed && styles.submitBtnPressed
            ]}
          >
            <MaterialCommunityIcons name="account-plus" size={20} color={colors.white} />
            <Text style={styles.submitBtnText}>
              {submitting ? 'Creating Account…' : 'Create Wholesale Account'}
            </Text>
          </Pressable>

          {/* FOOTER NAVIGATION */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
              <Text style={styles.footerLink}>Sign In</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg
  },
  flex: {
    flex: 1
  },
  topBar: {
    paddingHorizontal: 18,
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
  scrollContainer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 40
  },
  mainCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  brandIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  logoImage: {
    width: 58,
    height: 58,
    borderRadius: 14
  },
  headerBadge: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 6
  },
  headerBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.8
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    flex: 1
  },
  formSection: {
    gap: 16
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  requiredStar: {
    color: colors.danger,
    fontWeight: '900'
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    minHeight: 48,
    gap: 9
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.card
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface
  },
  inputVerified: {
    borderColor: colors.success,
    backgroundColor: colors.successSurface
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10
  },
  errorText: {
    color: colors.danger,
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
    marginLeft: 2
  },
  otpSendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84
  },
  otpSendBtnDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.8
  },
  otpSendBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800'
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSurface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.successBorder
  },
  verifiedBadgeText: {
    color: colors.success,
    fontSize: 11.5,
    fontWeight: '800'
  },
  otpSection: {
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  otpSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary
  },
  resendTimerText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700'
  },
  resendActiveText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800'
  },
  verifyButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    gap: 6
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '800'
  },
  eyeBtn: {
    padding: 4
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    ...shadows.floating
  },
  submitBtnPressed: {
    backgroundColor: colors.primaryPressed
  },
  buttonDisabled: {
    opacity: 0.6
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  },
  footerLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900'
  }
});
