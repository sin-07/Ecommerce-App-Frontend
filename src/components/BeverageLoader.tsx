import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

export type BeverageLoaderMode = 'auth' | 'catalog' | 'order' | 'success' | 'dispatch' | 'custom';

type Props = {
  visible: boolean;
  mode?: BeverageLoaderMode;
  title?: string;
  subtitle?: string;
};

const modeConfig: Record<BeverageLoaderMode, { title: string; subtitle: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; liquidColor: string }> = {
  auth: {
    title: 'AP Enterprises',
    subtitle: 'Preparing your beverage portal...',
    icon: 'bottle-soda-classic',
    liquidColor: colors.primary
  },
  catalog: {
    title: 'Loading Catalog',
    subtitle: 'Refreshing wholesale beverage stocks...',
    icon: 'bottle-soda-classic-outline',
    liquidColor: colors.accent
  },
  order: {
    title: 'Processing Order',
    subtitle: 'Preparing wholesale invoice & logistics...',
    icon: 'cart-arrow-down',
    liquidColor: colors.citrus
  },
  success: {
    title: 'Order Confirmed!',
    subtitle: 'Confirmation sent & dispatched to warehouse.',
    icon: 'check-decagram',
    liquidColor: colors.success
  },
  dispatch: {
    title: 'Order Dispatched',
    subtitle: 'Your beverage cases are on the way!',
    icon: 'truck-fast',
    liquidColor: colors.primary
  },
  custom: {
    title: 'AP Enterprises',
    subtitle: 'Please wait a moment...',
    icon: 'bottle-soda-classic',
    liquidColor: colors.primary
  }
};

export const BeverageLoader: React.FC<Props> = ({
  visible,
  mode = 'catalog',
  title,
  subtitle
}) => {
  const config = modeConfig[mode] || modeConfig.catalog;
  const displayTitle = title || config.title;
  const displaySubtitle = subtitle || config.subtitle;

  // Liquid Fill Animation
  const fillAnim = useRef(new Animated.Value(0)).current;
  // Bubble 1, 2, 3 animations
  const bubble1 = useRef(new Animated.Value(0)).current;
  const bubble2 = useRef(new Animated.Value(0)).current;
  const bubble3 = useRef(new Animated.Value(0)).current;
  // Shine sweep
  const shineAnim = useRef(new Animated.Value(0)).current;
  // Pulse scale
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    // 1. Continuous liquid wave fill
    const liquidLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(fillAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false
        }),
        Animated.timing(fillAnim, {
          toValue: 0.2,
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false
        })
      ])
    );

    // 2. Rising bubbles
    const bubbleLoop = Animated.loop(
      Animated.stagger(300, [
        Animated.sequence([
          Animated.timing(bubble1, { toValue: 1, duration: 1100, useNativeDriver: true }),
          Animated.timing(bubble1, { toValue: 0, duration: 0, useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.timing(bubble2, { toValue: 1, duration: 1300, useNativeDriver: true }),
          Animated.timing(bubble2, { toValue: 0, duration: 0, useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.timing(bubble3, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(bubble3, { toValue: 0, duration: 0, useNativeDriver: true })
        ])
      ])
    );

    // 3. Gentle container pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true })
      ])
    );

    liquidLoop.start();
    bubbleLoop.start();
    pulseLoop.start();

    return () => {
      liquidLoop.stop();
      bubbleLoop.stop();
      pulseLoop.stop();
    };
  }, [visible, fillAnim, bubble1, bubble2, bubble3, pulseAnim]);

  if (!visible) return null;

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['15%', '92%']
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
          {/* BOTTLE SILHOUETTE CONTAINER */}
          <View style={styles.bottleContainer}>
            {/* BOTTLE CAP */}
            <View style={styles.bottleCap} />
            {/* BOTTLE NECK */}
            <View style={styles.bottleNeck} />

            {/* BOTTLE BODY WITH LIQUID FILL */}
            <View style={styles.bottleBody}>
              {/* LIQUID FILL LAYER */}
              <Animated.View
                style={[
                  styles.liquid,
                  {
                    height: fillHeight,
                    backgroundColor: config.liquidColor
                  }
                ]}
              />

              {/* RISING BUBBLE 1 */}
              <Animated.View
                style={[
                  styles.bubble,
                  styles.bubbleLeft,
                  {
                    opacity: bubble1.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      {
                        translateY: bubble1.interpolate({ inputRange: [0, 1], outputRange: [40, -30] })
                      }
                    ]
                  }
                ]}
              />

              {/* RISING BUBBLE 2 */}
              <Animated.View
                style={[
                  styles.bubble,
                  styles.bubbleCenter,
                  {
                    opacity: bubble2.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      {
                        translateY: bubble2.interpolate({ inputRange: [0, 1], outputRange: [45, -35] })
                      }
                    ]
                  }
                ]}
              />

              {/* RISING BUBBLE 3 */}
              <Animated.View
                style={[
                  styles.bubble,
                  styles.bubbleRight,
                  {
                    opacity: bubble3.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      {
                        translateY: bubble3.interpolate({ inputRange: [0, 1], outputRange: [35, -25] })
                      }
                    ]
                  }
                ]}
              />

              {/* BRAND EMBLEM ON BOTTLE */}
              <View style={styles.bottleEmblem}>
                <Text style={styles.emblemText}>AP</Text>
              </View>
            </View>
          </View>

          {/* COPY */}
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.subtitle}>{displaySubtitle}</Text>

          {/* PROGRESS PILL */}
          <View style={styles.progressPill}>
            <View style={[styles.pulseDot, { backgroundColor: config.liquidColor }]} />
            <Text style={styles.progressText}>AP Enterprises B2B</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.modal
  },
  bottleContainer: {
    width: 70,
    height: 110,
    alignItems: 'center',
    marginBottom: 20
  },
  bottleCap: {
    width: 20,
    height: 8,
    backgroundColor: colors.navy,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4
  },
  bottleNeck: {
    width: 14,
    height: 16,
    backgroundColor: 'rgba(29, 78, 216, 0.12)',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.primary
  },
  bottleBody: {
    width: 62,
    height: 84,
    borderWidth: 2.5,
    borderColor: colors.primary,
    borderRadius: 14,
    backgroundColor: colors.infoSurface,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  liquid: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    opacity: 0.88
  },
  bubble: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.9)'
  },
  bubbleLeft: {
    left: 14,
    bottom: 10
  },
  bubbleCenter: {
    left: 28,
    bottom: 6,
    width: 8,
    height: 8,
    borderRadius: 4
  },
  bubbleRight: {
    right: 14,
    bottom: 12
  },
  bottleEmblem: {
    position: 'absolute',
    top: 24,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadows.sm
  },
  emblemText: {
    color: colors.primary,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  title: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16
  },
  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  progressText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  }
});
