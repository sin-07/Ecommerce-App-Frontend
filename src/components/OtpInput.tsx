import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  View
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

export type OtpInputHandle = {
  shake: () => void;
  success: () => void;
  reset: () => void;
  focus: () => void;
};

type Props = {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
};

export const OtpInput = forwardRef<OtpInputHandle, Props>(
  ({ length = 6, value, onChange, onComplete, disabled = false, hasError = false }, ref) => {
    const inputRefs = useRef<Array<TextInput | null>>([]);
    const [isSuccess, setIsSuccess] = useState(false);

    // Shake animation
    const shakeAnim = useRef(new Animated.Value(0)).current;
    // Success scale animation
    const successScale = useRef(new Animated.Value(1)).current;

    useImperativeHandle(ref, () => ({
      shake: () => {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true })
        ]).start();
      },
      success: () => {
        setIsSuccess(true);
        Animated.sequence([
          Animated.timing(successScale, { toValue: 1.08, duration: 150, useNativeDriver: true }),
          Animated.spring(successScale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
        ]).start();
      },
      reset: () => {
        setIsSuccess(false);
        onChange('');
        inputRefs.current[0]?.focus();
      },
      focus: () => {
        inputRefs.current[0]?.focus();
      }
    }));

    const digits = value.split('');

    const handleChangeText = (text: string, index: number) => {
      // Check if user pasted multiple digits (e.g. 6 digits from clipboard)
      const cleanText = text.replace(/[^0-9]/g, '');

      if (cleanText.length > 1) {
        const pastedCode = cleanText.slice(0, length);
        onChange(pastedCode);
        const nextFocusIndex = Math.min(pastedCode.length, length - 1);
        inputRefs.current[nextFocusIndex]?.focus();
        if (pastedCode.length === length && onComplete) {
          onComplete(pastedCode);
        }
        return;
      }

      const newDigits = [...digits];
      newDigits[index] = cleanText;
      const newCode = newDigits.join('').slice(0, length);
      onChange(newCode);

      if (cleanText.length > 0 && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newCode.length === length && onComplete) {
        onComplete(newCode);
      }
    };

    const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      if (e.nativeEvent.key === 'Backspace') {
        if (!digits[index] && index > 0) {
          inputRefs.current[index - 1]?.focus();
          const newDigits = [...digits];
          newDigits[index - 1] = '';
          onChange(newDigits.join(''));
        }
      }
    };

    return (
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateX: shakeAnim }, { scale: successScale }] }
        ]}
      >
        <View style={styles.boxRow}>
          {Array.from({ length }, (_, i) => {
            const digit = digits[i] || '';
            const isFilled = digit.length > 0;
            const isCurrent = digits.length === i;

            return (
              <View
                key={`otp-box-${i}`}
                style={[
                  styles.box,
                  isFilled && styles.boxFilled,
                  isCurrent && styles.boxCurrent,
                  hasError && styles.boxError,
                  isSuccess && styles.boxSuccess
                ]}
              >
                <TextInput
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  value={digit}
                  onChangeText={(txt) => handleChangeText(txt, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={length} // Allow paste in any box
                  selectTextOnFocus
                  editable={!disabled}
                  style={[
                    styles.input,
                    hasError && styles.inputError,
                    isSuccess && styles.inputSuccess
                  ]}
                  textAlign="center"
                  accessibilityLabel={`Verification code digit ${i + 1}`}
                />
              </View>
            );
          })}
        </View>

        {isSuccess && (
          <View style={styles.successIndicator}>
            <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
          </View>
        )}
      </Animated.View>
    );
  }
);

OtpInput.displayName = 'OtpInput';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    maxWidth: 360
  },
  box: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.card
  },
  boxCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.card
  },
  boxError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface
  },
  boxSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successSurface
  },
  input: {
    width: '100%',
    height: '100%',
    color: colors.navy,
    fontSize: 22,
    fontWeight: '900',
    padding: 0
  },
  inputError: {
    color: colors.danger
  },
  inputSuccess: {
    color: colors.success
  },
  successIndicator: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  }
});
