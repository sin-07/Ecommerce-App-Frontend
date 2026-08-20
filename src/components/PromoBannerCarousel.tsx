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
const TRANSITION_DURATION = 540;

export const PromoBannerCarousel: React.FC<Props> = React.memo(({
  slides = PROMO_SLIDES,
  onSelectCategory,
  autoSlideInterval = AUTO_SLIDE_DEFAULT
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = useMemo(() => windowWidth - 32, [windowWidth]);

  // Active dot indicator state (only controls pagination dots)
  const [activeDot, setActiveDot] = useState(0);

  // Current active slide index ref (source of truth for transitions)
  const currIndexRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const isInteractingRef = useRef(false);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dedicated Animated.Value for each permanently mounted slide
  const slideAnims = useRef<Animated.Value[]>(
    slides.map((_, index) => new Animated.Value(index === 0 ? 0 : cardWidth))
  ).current;

  // Handle window width updates
  useEffect(() => {
    slides.forEach((_, index) => {
      if (index !== currIndexRef.current && !isTransitioningRef.current) {
        slideAnims[index].setValue(cardWidth);
      }
    });
  }, [cardWidth, slides, slideAnims]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  const goToSlide = useCallback(
    (targetIndex: number, direction: 'next' | 'prev' = 'next') => {
      if (isTransitioningRef.current || targetIndex === currIndexRef.current) return;
      if (targetIndex < 0 || targetIndex >= slides.length) return;

      stopAutoPlay();
      isTransitioningRef.current = true;

      const currentIdx = currIndexRef.current;
      const startPos = direction === 'next' ? cardWidth : -cardWidth;
      const endPos = direction === 'next' ? -cardWidth : cardWidth;

      // Position target slide just outside viewport
      slideAnims[targetIndex].setValue(startPos);

      // Smooth horizontal GPU translation
      Animated.parallel([
        Animated.timing(slideAnims[currentIdx], {
          toValue: endPos,
          duration: TRANSITION_DURATION,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
          useNativeDriver: true
        }),
        Animated.timing(slideAnims[targetIndex], {
          toValue: 0,
          duration: TRANSITION_DURATION,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (finished) {
          currIndexRef.current = targetIndex;
          setActiveDot(targetIndex);
          isTransitioningRef.current = false;

          // Park all off-screen slides cleanly
          slides.forEach((_, idx) => {
            if (idx !== targetIndex) {
              slideAnims[idx].setValue(cardWidth);
            }
          });

          startAutoPlay();
        }
      });
    },
    [cardWidth, slides, slideAnims, stopAutoPlay]
  );

  const nextSlide = useCallback(() => {
    const nextIdx = (currIndexRef.current + 1) % slides.length;
    goToSlide(nextIdx, 'next');
  }, [slides.length, goToSlide]);

  const prevSlide = useCallback(() => {
    const prevIdx = (currIndexRef.current - 1 + slides.length) % slides.length;
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

  // Dedicated PanResponder isolated strictly to the Hero Carousel container
  const carouselPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 15;
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

  return (
    <View style={styles.container} {...carouselPanResponder.panHandlers}>
      {/* 
        PERMANENTLY MOUNTED SLIDE STAGE:
        All slides remain continuously mounted in separate GPU-native layers.
        Zero unmounting, zero conditional switching, zero image reloading, zero flicker.
      */}
      <View style={[styles.carouselStage, { width: cardWidth }]}>
        {slides.map((slide, index) => {
          return (
            <Animated.View
              key={slide.id}
              style={[
                styles.slideLayer,
                {
                  width: cardWidth,
                  transform: [{ translateX: slideAnims[index] }]
                }
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.heroCard, { backgroundColor: slide.bg }]}
                onPress={() => {
                  if (onSelectCategory) {
                    onSelectCategory(slide.category);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`${slide.tag} - ${slide.title}`}
              >
                <View style={[styles.ambientGlow, { backgroundColor: slide.accent }]} />

                <View style={styles.contentWrap}>
                  <View style={[styles.tagBadge, { borderColor: slide.accent }]}>
                    <MaterialCommunityIcons name={slide.icon} size={13} color={slide.accent} />
                    <Text style={[styles.tagText, { color: slide.accent }]}>{slide.tag}</Text>
                  </View>

                  <Text style={styles.titleText} numberOfLines={1}>
                    {slide.title}
                  </Text>
                  <Text style={styles.subtitleText} numberOfLines={2}>
                    {slide.subtitle}
                  </Text>

                  <View style={styles.btnRow}>
                    <View style={[styles.actionBtn, { backgroundColor: slide.accent }]}>
                      <Text style={styles.actionBtnText}>{slide.buttonLabel}</Text>
                      <Ionicons name="arrow-forward" size={13} color="#0F172A" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* ANIMATED PAGINATION PILLS */}
      <View style={styles.paginationRow}>
        {slides.map((slide, i) => {
          const isActive = activeDot === i;

          return (
            <Pressable
              key={`dot-${slide.id}`}
              onPress={() => goToSlide(i, i > currIndexRef.current ? 'next' : 'prev')}
              hitSlop={8}
              style={({ pressed }) => [styles.dotWrap, pressed && { opacity: 0.7 }]}
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
    backgroundColor: '#0B1220',
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
