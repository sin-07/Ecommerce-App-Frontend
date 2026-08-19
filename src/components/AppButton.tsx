import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

type Props = {
  title: string;
  onPress: () => void | Promise<unknown>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
};

export const AppButton: React.FC<Props> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false
}) => {
  const [tapLoading, setTapLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isBusy = loading || tapLoading;
  const isInactive = disabled || isBusy;

  const handlePress = () => {
    if (isInactive) return;

    try {
      const result = onPress();

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        setTapLoading(true);
        Promise.resolve(result)
          .catch(() => null)
          .finally(() => setTapLoading(false));
        return;
      }

      setTapLoading(true);
      timeoutRef.current = setTimeout(() => setTapLoading(false), 250);
    } catch {
      setTapLoading(false);
    }
  };

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 2
    }).start();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: colors.cardAlt,
          border: colors.border,
          text: colors.text,
          iconColor: colors.textSecondary
        };
      case 'outline':
        return {
          bg: colors.card,
          border: colors.primary,
          text: colors.primary,
          iconColor: colors.primary
        };
      case 'success':
        return {
          bg: colors.success,
          border: colors.success,
          text: colors.white,
          iconColor: colors.white
        };
      case 'danger':
        return {
          bg: colors.danger,
          border: colors.danger,
          text: colors.white,
          iconColor: colors.white
        };
      case 'primary':
      default:
        return {
          bg: colors.primary,
          border: colors.primary,
          text: colors.white,
          iconColor: colors.white
        };
    }
  };

  const styleConfig = getVariantStyles();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth]}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isInactive}
        style={[
          styles.base,
          size === 'sm' && styles.sizeSm,
          size === 'md' && styles.sizeMd,
          size === 'lg' && styles.sizeLg,
          { backgroundColor: styleConfig.bg, borderColor: styleConfig.border },
          isInactive && styles.disabled,
          fullWidth && styles.fullWidth
        ]}
      >
        {isBusy ? (
          <ActivityIndicator size="small" color={styleConfig.text} style={styles.spinner} />
        ) : (
          <View style={styles.contentRow}>
            {icon && iconPosition === 'left' && (
              <MaterialCommunityIcons
                name={icon}
                size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18}
                color={styleConfig.iconColor}
              />
            )}
            <Text
              style={[
                styles.title,
                size === 'sm' && styles.textSm,
                size === 'md' && styles.textMd,
                size === 'lg' && styles.textLg,
                { color: styleConfig.text }
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <MaterialCommunityIcons
                name={icon}
                size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18}
                color={styleConfig.iconColor}
              />
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  fullWidth: {
    width: '100%'
  },
  sizeSm: {
    minHeight: 38,
    paddingHorizontal: 12
  },
  sizeMd: {
    minHeight: 48,
    paddingHorizontal: 16
  },
  sizeLg: {
    minHeight: 54,
    paddingHorizontal: 20
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.2
  },
  textSm: {
    fontSize: 12.5
  },
  textMd: {
    fontSize: 14
  },
  textLg: {
    fontSize: 15.5
  },
  disabled: {
    opacity: 0.55
  },
  spinner: {
    paddingVertical: 2
  }
});
