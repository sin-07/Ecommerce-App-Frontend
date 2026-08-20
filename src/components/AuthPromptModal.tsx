import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';
import { Product } from '../constants/types';
import { formatINR } from '../utils/currency';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AuthPromptAction = 'cart' | 'buy_now' | 'wishlist' | 'orders' | 'checkout' | 'general';

type Props = {
  visible: boolean;
  action?: AuthPromptAction;
  product?: Product | null;
  quantity?: number;
  onClose: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
};

const ACTION_MESSAGES: Record<
  AuthPromptAction,
  { title: string; subtitle: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }
> = {
  cart: {
    title: 'Sign In Required',
    subtitle: 'Create a wholesale account or sign in to add items to your cart and lock in tiered B2B pricing.',
    icon: 'cart-plus'
  },
  buy_now: {
    title: 'Sign In Required',
    subtitle: 'Sign in or create an account to proceed with instant wholesale checkout and delivery.',
    icon: 'lightning-bolt'
  },
  wishlist: {
    title: 'Sign In Required',
    subtitle: 'Sign in to save commercial beverage and egg supplies to your business wishlist.',
    icon: 'heart-outline'
  },
  orders: {
    title: 'Sign In Required',
    subtitle: 'Sign in to track your wholesale orders, view live fulfillment status, and download invoices.',
    icon: 'truck-delivery-outline'
  },
  checkout: {
    title: 'Sign In Required',
    subtitle: 'Sign in or create an account to place and track your wholesale dispatch orders.',
    icon: 'shield-check-outline'
  },
  general: {
    title: 'Sign In Required',
    subtitle: 'Sign in to access AP Enterprises wholesale features, trade rates, and order fulfillment.',
    icon: 'storefront-outline'
  }
};

export const AuthPromptModal: React.FC<Props> = ({
  visible,
  action = 'general',
  product,
  quantity = 1,
  onClose,
  onSignIn,
  onSignUp
}) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [visible, animValue]);

  if (!visible) return null;

  const content = ACTION_MESSAGES[action] || ACTION_MESSAGES.general;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55]
  });

  const modalTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0]
  });

  const modalScale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1]
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Animated Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Modal Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: animValue,
              transform: [{ translateY: modalTranslateY }, { scale: modalScale }]
            }
          ]}
        >
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={8}
            accessibilityLabel="Close sign in dialog"
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Icon header */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={content.icon} size={28} color={colors.primary} />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>

          {/* Optional Product Preview Badge */}
          {product ? (
            <View style={styles.productSnippet}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.productThumb} resizeMode="cover" />
              ) : (
                <View style={styles.productThumbFallback}>
                  <MaterialCommunityIcons name="cube-outline" size={20} color={colors.primary} />
                </View>
              )}
              <View style={styles.productSnippetCopy}>
                <Text style={styles.productSnippetName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.productSnippetPrice}>
                  {formatINR(product.price)} • {quantity} {product.unit || 'piece'}{quantity > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.signInButton} activeOpacity={0.88} onPress={onSignIn}>
              <MaterialCommunityIcons name="login" size={18} color={colors.white} />
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signUpButton} activeOpacity={0.88} onPress={onSignUp}>
              <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.primary} />
              <Text style={styles.signUpButtonText}>Create Wholesale Account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.continueBtn} activeOpacity={0.7} onPress={onClose}>
              <Text style={styles.continueBtnText}>Continue Browsing</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A'
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 40, 380),
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 6,
    marginBottom: 16
  },
  productSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 10,
    width: '100%',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10
  },
  productThumb: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt
  },
  productThumbFallback: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  productSnippetCopy: {
    flex: 1,
    gap: 2
  },
  productSnippetName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  productSnippetPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary
  },
  buttonGroup: {
    width: '100%',
    gap: 10
  },
  signInButton: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.sm
  },
  signInButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700'
  },
  signUpButton: {
    height: 48,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  signUpButtonText: {
    color: colors.primary,
    fontSize: 14.5,
    fontWeight: '700'
  },
  continueBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  continueBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  }
});
