import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows } from '../constants/theme';
import { toast, ToastType } from '../utils/toast';

type ToastState = {
  visible: boolean;
  message: string;
  title?: string;
  type: ToastType;
};

const config: Record<
  ToastType,
  {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    color: string;
    bg: string;
    border: string;
    label: string;
  }
> = {
  success: {
    icon: 'check-circle',
    color: colors.success,
    bg: colors.successSurface,
    border: colors.successBorder,
    label: 'Success'
  },
  error: {
    icon: 'close-circle',
    color: colors.danger,
    bg: colors.dangerSurface,
    border: colors.dangerBorder,
    label: 'Something went wrong'
  },
  warning: {
    icon: 'alert-circle',
    color: '#B45309',
    bg: colors.warningSurface,
    border: colors.warningBorder,
    label: 'Attention Required'
  },
  info: {
    icon: 'information',
    color: colors.primary,
    bg: colors.infoSurface,
    border: colors.infoBorder,
    label: 'AP Enterprises'
  }
};

export const ToastHost: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info'
  });

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      })
    ]).start(() => setState((prev) => ({ ...prev, visible: false })));
  };

  useEffect(() => {
    const unsubscribe = toast.subscribe(({ message, type = 'info', title }) => {
      if (timer.current) clearTimeout(timer.current);
      setState({ visible: true, message, type, title });

      translateY.setValue(-120);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 24,
          bounciness: 3
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true
        })
      ]).start();

      timer.current = setTimeout(dismiss, 3400);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity, translateY]);

  if (!state.visible) return null;

  const visual = config[state.type];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          top: Math.max(10, insets.top + 8),
          opacity,
          transform: [{ translateY }]
        }
      ]}
    >
      <View style={[styles.toast, { backgroundColor: visual.bg, borderColor: visual.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons name={visual.icon} size={22} color={visual.color} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{state.title || visual.label}</Text>
          <Text style={styles.message} numberOfLines={2}>
            {state.message}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss notification"
          onPress={dismiss}
          style={styles.close}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 1000,
    alignItems: 'center'
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.modal
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm
  },
  copy: {
    flex: 1,
    gap: 2
  },
  title: {
    color: colors.navy,
    fontSize: 13.5,
    fontWeight: '900'
  },
  message: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600'
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)'
  }
});
