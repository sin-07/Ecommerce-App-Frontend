import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../constants/theme';

export type PromoSlide = {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  bg: string;
  accent: string;
  category: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

export const PROMO_SLIDES: PromoSlide[] = [
  {
    id: 'slide-beverages',
    tag: 'DIRECT FACTORY SUPPLY',
    title: 'Chilled Beverages Wholesale',
    subtitle: 'Coca-Cola, Pepsi, Sprite, energy drinks and more.',
    buttonLabel: 'Explore Beverages',
    bg: '#0B1220',
    accent: '#38BDF8',
    category: 'Beverages',
    icon: 'cup-water'
  },
  {
    id: 'slide-eggs',
    tag: 'FARM FRESH SUPPLY',
    title: 'Fresh Farm Eggs',
    subtitle: 'Quality eggs available in packs, trays and bulk quantities.',
    buttonLabel: 'Explore Eggs',
    bg: '#1C1308',
    accent: '#F59E0B',
    category: 'Eggs',
    icon: 'egg-outline'
  },
  {
    id: 'slide-wholesale',
    tag: 'B2B WHOLESALE SUPPLY',
    title: 'Everything your business needs in bulk.',
    subtitle: 'Competitive wholesale pricing for commercial buyers.',
    buttonLabel: 'Explore Wholesale',
    bg: '#0F172A',
    accent: '#818CF8',
    category: 'Existing Products',
    icon: 'cube-outline'
  },
  {
    id: 'slide-logistics',
    tag: 'FAST BUSINESS DELIVERY',
    title: 'Reliable Bulk Dispatch',
    subtitle: 'Smooth fulfillment for eligible wholesale orders.',
    buttonLabel: 'View Products',
    bg: '#062E25',
    accent: '#34D399',
    category: '',
    icon: 'truck-fast-outline'
  }
];

type Props = {
  slides?: PromoSlide[];
  onSelectCategory?: (category: string) => void;
  autoSlideInterval?: number;
};

const AUTO_SLIDE_DEFAULT = 4800;
const TRANSITION_DURATION = 520;

export const PromoBannerCarousel: React.FC<Props> = React.memo(({
  slides = PROMO_SLIDES,
  onSelectCategory,
  autoSlideInterval = AUTO_SLIDE_DEFAULT
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = useMemo(() => windowWidth - 32, [windowWidth]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Transition animation value: 0 -> 1
  const transitionAnim = useRef(new Animated.Value(0)).current;
  const isTransitioningRef = useRef(false);
  const currentIndexRef = useRef(0);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  const goToSlide = useCallback(
    (nextIdx: number, dir: 'next' | 'prev' = 'next') => {
      if (isTransitioningRef.current || nextIdx === currentIndexRef.current) return;
      if (nextIdx < 0 || nextIdx >= slides.length) return;

      stopAutoPlay();
      isTransitioningRef.current = true;
      setIsTransitioning(true);
      setDirection(dir);
      setTargetIndex(nextIdx);
      transitionAnim.setValue(0);

      Animated.timing(transitionAnim, {
        toValue: 1,
        duration: TRANSITION_DURATION,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) {
          currentIndexRef.current = nextIdx;
          setCurrentIndex(nextIdx);
          setTargetIndex(null);
          transitionAnim.setValue(0);
          isTransitioningRef.current = false;
          setIsTransitioning(false);
          startAutoPlay();
        }
      });
    },
    [slides.length, transitionAnim, stopAutoPlay]
  );

  const nextSlide = useCallback(() => {
    const nextIdx = (currentIndexRef.current + 1) % slides.length;
    goToSlide(nextIdx, 'next');
  }, [slides.length, goToSlide]);

  const prevSlide = useCallback(() => {
    const prevIdx = (currentIndexRef.current - 1 + slides.length) % slides.length;
    goToSlide(prevIdx, 'prev');
  }, [slides.length, goToSlide]);

  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    if (slides.length <= 1) return;

    autoPlayTimerRef.current = setTimeout(() => {
      if (isInteractingRef.current || isTransitioningRef.current) return;
      nextSlide();
    }, autoSlideInterval);
  }, [autoSlideInterval, slides.length, stopAutoPlay, nextSlide]);

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, [startAutoPlay, stopAutoPlay]);

  // PanResponder for manual swiping
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 20;
        },
        onPanResponderGrant: () => {
          isInteractingRef.current = true;
          stopAutoPlay();
        },
        onPanResponderRelease: (_, gestureState) => {
          isInteractingRef.current = false;
          if (gestureState.dx < -35) {
            nextSlide();
          } else if (gestureState.dx > 35) {
            prevSlide();
          } else {
            startAutoPlay();
          }
        },
        onPanResponderTerminate: () => {
          isInteractingRef.current = false;
          startAutoPlay();
        }
      }),
    [nextSlide, prevSlide, startAutoPlay, stopAutoPlay]
  );

  const currentSlide = slides[currentIndex];
  const nextSlideData = targetIndex !== null ? slides[targetIndex] : null;

  // Compute slide transforms
  const currentTranslateX = transitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, direction === 'next' ? -cardWidth : cardWidth]
  });

  const nextTranslateX = transitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [direction === 'next' ? cardWidth : -cardWidth, 0]
  });

  const renderSlideContent = (item: PromoSlide) => (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[styles.heroCard, { backgroundColor: item.bg }]}
      onPress={() => {
        if (onSelectCategory) {
          onSelectCategory(item.category);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={`${item.tag} - ${item.title}`}
    >
      <View style={[styles.ambientGlow, { backgroundColor: item.accent }]} />

      <View style={styles.contentWrap}>
        <View style={[styles.tagBadge, { borderColor: item.accent }]}>
          <MaterialCommunityIcons name={item.icon} size={13} color={item.accent} />
          <Text style={[styles.tagText, { color: item.accent }]}>{item.tag}</Text>
        </View>

        <Text style={styles.titleText} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitleText} numberOfLines={2}>
          {item.subtitle}
        </Text>

        <View style={styles.btnRow}>
          <View style={[styles.actionBtn, { backgroundColor: item.accent }]}>
            <Text style={styles.actionBtnText}>{item.buttonLabel}</Text>
            <Ionicons name="arrow-forward" size={13} color="#0F172A" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* TWO-LAYER STABLE CAROUSEL CONTAINER (NEVER UNMOUNTS OR FLICKERS) */}
      <View style={[styles.carouselStage, { width: cardWidth }]}>
        {/* CURRENT VISIBLE SLIDE */}
        <Animated.View
          style={[
            styles.slideLayer,
            { width: cardWidth, transform: [{ translateX: currentTranslateX }] }
          ]}
        >
          {renderSlideContent(currentSlide)}
        </Animated.View>

        {/* TRANSITIONING NEXT SLIDE LAYER */}
        {isTransitioning && nextSlideData ? (
          <Animated.View
            style={[
              styles.slideLayer,
              { width: cardWidth, transform: [{ translateX: nextTranslateX }] }
            ]}
          >
            {renderSlideContent(nextSlideData)}
          </Animated.View>
        ) : null}
      </View>

      {/* ANIMATED PAGINATION PILLS */}
      <View style={styles.paginationRow}>
        {slides.map((slide, i) => {
          const isActive = (targetIndex !== null ? targetIndex : currentIndex) === i;

          return (
            <Pressable
              key={slide.id}
              onPress={() => goToSlide(i, i > currentIndex ? 'next' : 'prev')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.dotWrap,
                pressed && { opacity: 0.7 }
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Slide ${i + 1}`}
            >
              <View
                style={[
                  styles.dot,
                  isActive
                    ? [styles.dotActive, { backgroundColor: slide.accent }]
                    : styles.dotInactive
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

PromoBannerCarousel.displayName = 'PromoBannerCarousel';

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
    alignItems: 'center'
  },
  carouselStage: {
    height: 154,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0B1220', // Solid dark base prevents any white flash
    position: 'relative',
    ...shadows.card
  },
  slideLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%'
  },
  heroCard: {
    width: '100%',
    height: '100%',
    padding: 16,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden'
  },
  ambientGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.16
  },
  contentWrap: {
    gap: 4,
    zIndex: 2,
    flex: 1,
    justifyContent: 'center'
  },
  tagBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radius.pill,
    marginBottom: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.35)'
  },
  tagText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  titleText: {
    fontSize: 16.5,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.1
  },
  subtitleText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#CBD5E1',
    marginBottom: 6
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    ...shadows.sm
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A'
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10
  },
  dotWrap: {
    padding: 2
  },
  dot: {
    height: 5,
    borderRadius: radius.pill
  },
  dotActive: {
    width: 22
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#CBD5E1'
  }
});
