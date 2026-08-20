import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { OtpInput, OtpInputHandle } from '../components/OtpInput';
import { BeverageLoader } from '../components/BeverageLoader';
import { api } from '../constants/api';
import { colors, radius, shadows } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { RootStackParamList } from '../navigation/types';
import { register, verifyOtp } from '../redux/slices/authSlice';
import { toast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+0-9\s\-()]{7,20}$/;

const maskEmail = (value: string) => {
  const [name, domain] = value.trim().split('@');
  if (!name || !domain) return value;
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(4, name.length - 2)))}@${domain}`;
};

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.auth);

  // Form State
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('AP Enterprises');
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

  const validateForm = () => {
    const next: Record<string, string> = {};

    if (name.trim().length < 2) {
      next.name = 'Full name must be at least 2 characters';
    }

    if (!emailPattern.test(email.trim())) {
      next.email = 'Enter a valid business email address';
    }

    if (phone.trim().length > 0 && !phonePattern.test(phone.trim())) {
      next.phone = 'Enter a valid contact phone number';
    }

    if (password.length < 6) {
      next.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
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

    if (!emailPattern.test(cleanEmail)) {
      setFieldErrors((curr) => ({ ...curr, email: 'Enter a valid business email first' }));
      toast.show('Please enter a valid email address first.', 'error');
      scrollToInput(120);
      return;
    }

    if (seconds > 0 || otpLoading || otpRequestLock.current) return;
    otpRequestLock.current = true;
    setOtpLoading(true);

    try {
      await api.post('/auth/request-otp', { email: cleanEmail });
      setOtpSent(true);
      setOtpVerified(false);
      setOtp('');
      setSeconds(45);
      toast.show(`Verification code sent to ${maskEmail(cleanEmail)}`, 'success', 'Code Sent');
      scrollToInput(280);
    } catch (requestError: any) {
      const status = requestError?.response?.status;
      const message =
        status === 409
          ? 'This email is already registered. Please sign in.'
          : status === 429
          ? 'Please wait before requesting another code.'
          : requestError?.response?.data?.message || 'Unable to send verification email.';
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
      toast.show('Please fix the highlighted fields to continue.', 'error');
      return;
    }

    if (!otpVerified) {
      setError('Please verify your email address before creating your account.');
      otpInputRef.current?.shake();
      toast.show('Verify your email with the 6-digit code first.', 'error');
      scrollToInput(280);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    const start = Date.now();

    try {
      await dispatch(
        register({
          name: name.trim(),
          companyName: companyName.trim() || 'AP Enterprises',
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          role: 'buyer',
          otp
        })
      ).unwrap();
      const elapsed = Date.now() - start;
      if (elapsed < 1600) {
        await new Promise((resolve) => setTimeout(() => resolve(true), 1600 - elapsed));
      }
      toast.show('Wholesale account created successfully! ✓', 'success', 'Welcome!');
    } catch (registrationError: any) {
      const elapsed = Date.now() - start;
      if (elapsed < 1200) {
        await new Promise((resolve) => setTimeout(() => resolve(true), 1200 - elapsed));
      }
      const message = String(registrationError || 'Something went wrong. Please try again.');
      setError(message);
      toast.show(message, 'error');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
    >
      <BeverageLoader visible={submitting} mode="auth" title="AP Enterprises" subtitle="Setting up your wholesale account..." />

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
              Direct B2B Beverage Supply • Bulk Pallet & Case Ordering
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
            {/* FULL NAME */}
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
                  placeholder="e.g. Aniket Singh"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    setFieldErrors((c) => ({ ...c, name: '' }));
                  }}
                  onFocus={() => {
                    setFocusedField('name');
                    scrollToInput(60);
                  }}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="words"
                  accessibilityLabel="Full name"
                />
              </View>
              {fieldErrors.name ? <Text style={styles.errorText}>{fieldErrors.name}</Text> : null}
            </View>

            {/* COMPANY NAME */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Company / Store Name</Text>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'company' && styles.inputFocused
                ]}
              >
                <MaterialCommunityIcons
                  name="domain"
                  size={20}
                  color={focusedField === 'company' ? colors.primary : colors.textMuted}
                />
                <NativeTextInput
                  style={styles.input}
                  placeholder="AP Enterprises"
                  placeholderTextColor={colors.textMuted}
                  value={companyName}
                  onChangeText={setCompanyName}
                  onFocus={() => {
                    setFocusedField('company');
                    scrollToInput(110);
                  }}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel="Company name"
                />
              </View>
            </View>

            {/* BUSINESS EMAIL WITH OTP ACTION */}
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
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel="Business email"
                />
                {!otpVerified ? (
                  <Pressable
                    onPress={requestOtp}
                    disabled={otpLoading || seconds > 0}
                    style={[styles.otpSendBtn, (otpLoading || seconds > 0) && styles.otpSendBtnDisabled]}
                  >
                    <Text style={styles.otpSendBtnText}>
                      {otpLoading
                        ? 'Sending…'
                        : seconds > 0
                        ? `${seconds}s`
                        : otpSent
                        ? 'Resend'
                        : 'Send Code'}
                    </Text>
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
                  <Text style={styles.otpSectionTitle}>Enter 6-Digit Email Code</Text>
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
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={18}
                    color={colors.white}
                  />
                  <Text style={styles.verifyButtonText}>
                    {otpVerifying ? 'Verifying Code…' : 'Verify Email Code'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* PHONE NUMBER */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Contact Phone Number</Text>
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
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v);
                    setFieldErrors((c) => ({ ...c, phone: '' }));
                  }}
                  keyboardType="phone-pad"
                  onFocus={() => {
                    setFocusedField('phone');
                    scrollToInput(360);
                  }}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel="Contact phone"
                />
              </View>
              {fieldErrors.phone ? <Text style={styles.errorText}>{fieldErrors.phone}</Text> : null}
            </View>

            {/* PASSWORD */}
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
                    setFieldErrors((c) => ({ ...c, password: '' }));
                  }}
                  secureTextEntry={!showPassword}
                  onFocus={() => {
                    setFocusedField('password');
                    scrollToInput(420);
                  }}
                  onBlur={() => setFocusedField(null)}
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

            {/* CONFIRM PASSWORD */}
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
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    setFieldErrors((c) => ({ ...c, confirmPassword: '' }));
                  }}
                  secureTextEntry={!showConfirmPassword}
                  onFocus={() => {
                    setFocusedField('confirmPassword');
                    scrollToInput(480);
                  }}
                  onBlur={() => setFocusedField(null)}
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

            {/* SUBMIT BUTTON */}
            <Pressable
              onPress={submitRegistration}
              disabled={loading || submitting}
              style={({ pressed }) => [
                styles.submitButton,
                (loading || submitting) && styles.buttonDisabled,
                pressed && { backgroundColor: colors.primaryPressed }
              ]}
            >
              <MaterialCommunityIcons name="account-plus" size={20} color={colors.white} />
              <Text style={styles.submitButtonText}>
                {submitting ? 'Creating Account…' : 'Create Wholesale Account'}
              </Text>
            </Pressable>

            <Text style={styles.termsText}>
              By creating an account, you agree to AP Enterprises wholesale beverage terms and conditions.
            </Text>
          </View>

          {/* FOOTER SWITCH */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={6}>
              <Text style={styles.footerLink}>Sign In</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 40
  },
  mainCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingVertical: 28,
    ...shadows.card
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  brandIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...shadows.card
  },
  logoImage: {
    width: '100%',
    height: '100%'
  },
  headerBadge: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    marginBottom: 6
  },
  headerBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  title: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center'
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17
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
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1
  },
  formSection: {
    gap: 14
  },
  fieldGroup: {
    gap: 5
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '700'
  },
  requiredStar: {
    color: colors.danger
  },
  inputWrap: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
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
  inputVerified: {
    borderColor: colors.success,
    backgroundColor: colors.successSurface
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0
  },
  eyeBtn: {
    padding: 4
  },
  otpSendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm
  },
  otpSendBtnDisabled: {
    backgroundColor: colors.cardAlt
  },
  otpSendBtnText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '800'
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  verifiedBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800'
  },
  otpSection: {
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  otpSectionTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900'
  },
  resendTimerText: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '700'
  },
  resendActiveText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800'
  },
  verifyButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '800'
  },
  submitButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900'
  },
  buttonDisabled: {
    opacity: 0.55
  },
  errorText: {
    color: colors.danger,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2
  },
  termsText: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 4
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 22
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 13
  },
  footerLink: {
    color: colors.primary,
    fontSize: 13.5,
    fontWeight: '900'
  }
});
