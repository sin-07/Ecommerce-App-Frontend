import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
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
  title: string;
  subtitle: string;
  tag: string;
  bg: string;
  accent: string;
  category?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

export const DEFAULT_PROMO_SLIDES: PromoSlide[] = [
  {
    id: 'bev',
    title: 'Chilled Beverages Wholesale',
    subtitle: 'Coca-Cola, Pepsi, Sprite, Red Bull in Bulk Crates & Cans',
    tag: '⚡ DIRECT FACTORY SUPPLY',
    bg: '#0F172A',
    accent: '#38BDF8',
    category: 'Beverages',
    icon: 'bottle-soda-classic-outline'
  },
  {
    id: 'egg',
    title: 'Daily Fresh Farm Eggs',
    subtitle: 'Grade-A Table Eggs, Country Brown Eggs in Trays of 30',
    tag: '🥚 100% FARM FRESH',
    bg: '#451A03',
    accent: '#FBBF24',
    category: 'Eggs',
    icon: 'egg-outline'
  },
  {
    id: 'fast',
    title: 'Same-Day Bulk Dispatch',
    subtitle: 'Free B2B Wholesale Delivery on Qualified Commercial Orders',
    tag: '🚚 EXPRESS LOGISTICS',
    bg: '#064E3B',
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

const AUTO_SLIDE_DEFAULT = 4500;

const PromoBannerCarouselBase: React.FC<Props> = ({
  slides = DEFAULT_PROMO_SLIDES,
  onSelectCategory,
  autoSlideInterval = AUTO_SLIDE_DEFAULT
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = useMemo(() => windowWidth - 32, [windowWidth]);

  // Infinite Virtual Slides: [Last, Slide0, Slide1, Slide2, First]
  const extendedSlides = useMemo(() => {
    if (slides.length <= 1) return slides;
    return [slides[slides.length - 1], ...slides, slides[0]];
  }, [slides]);

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(cardWidth)).current;
  const flatListRef = useRef<Animated.FlatList<any> | null>(null);
  const currentIndexRef = useRef(1); // starts at index 1 (Slide0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractingRef = useRef(false);

  // Initialize scroll position at first real slide (index 1)
  const initialScrollDone = useRef(false);

  // Auto-scroll controller
  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    if (slides.length <= 1) return;

    timerRef.current = setTimeout(() => {
      if (isInteractingRef.current) return;
      const nextIndex = currentIndexRef.current + 1;
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * cardWidth,
        animated: true
      });
      currentIndexRef.current = nextIndex;
    }, autoSlideInterval);
  }, [cardWidth, autoSlideInterval, slides.length]);

  const stopAutoScroll = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
  }, [startAutoScroll, stopAutoScroll]);

  // Handle silent repositioning for seamless infinite loop
  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    let index = Math.round(offsetX / cardWidth);

    if (slides.length > 1) {
      if (index === 0) {
        // Scrolled before first slide -> jump to last real slide
        index = slides.length;
        flatListRef.current?.scrollToOffset({
          offset: index * cardWidth,
          animated: false
        });
        scrollX.setValue(index * cardWidth);
      } else if (index === extendedSlides.length - 1) {
        // Scrolled past last slide -> jump to first real slide
        index = 1;
        flatListRef.current?.scrollToOffset({
          offset: index * cardWidth,
          animated: false
        });
        scrollX.setValue(index * cardWidth);
      }
    }

    currentIndexRef.current = index;
    const realIndex = slides.length > 1 ? (index - 1 + slides.length) % slides.length : index;
    setActiveIndex(realIndex);
    isInteractingRef.current = false;
    startAutoScroll();
  };

  const handleScrollBeginDrag = () => {
    isInteractingRef.current = true;
    stopAutoScroll();
  };

  const handleScrollEndDrag = () => {
    isInteractingRef.current = false;
    startAutoScroll();
  };

  const renderSlideItem = ({ item, index }: { item: PromoSlide; index: number }) => {
    // Interpolate scale & opacity for 3D depth and parallax feel
    const inputRange = [(index - 1) * cardWidth, index * cardWidth, (index + 1) * cardWidth];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.96, 1, 0.96],
      extrapolate: 'clamp'
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.82, 1, 0.82],
      extrapolate: 'clamp'
    });

    const contentTranslateX = scrollX.interpolate({
      inputRange,
      outputRange: [20, 0, -20],
      extrapolate: 'clamp'
    });

    return (
      <View style={[styles.slideOuter, { width: cardWidth }]}>
        <Animated.View
          style={[
            styles.heroCard,
            {
              backgroundColor: item.bg,
              transform: [{ scale }],
              opacity
            }
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.cardPressable}
            onPress={() => {
              if (item.category && onSelectCategory) {
                onSelectCategory(item.category);
              }
            }}
          >
            {/* BACKGROUND AMBIENT GLOW */}
            <View
              style={[
                styles.ambientGlow,
                { backgroundColor: item.accent }
              ]}
            />

            {/* PARALLAX INNER CONTENT */}
            <Animated.View
              style={[
                styles.heroTextContent,
                { transform: [{ translateX: contentTranslateX }] }
              ]}
            >
              <View style={[styles.heroTag, { borderColor: item.accent }]}>
                {item.icon ? (
                  <MaterialCommunityIcons name={item.icon} size={12} color={item.accent} />
                ) : null}
                <Text style={[styles.heroTagText, { color: item.accent }]}>{item.tag}</Text>
              </View>

              <Text style={styles.heroTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>

              <View style={[styles.heroShopBtn, { backgroundColor: item.accent }]}>
                <Text style={styles.heroShopText}>Explore Supply</Text>
                <Ionicons name="arrow-forward" size={13} color="#0F172A" />
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ANIMATED CAROUSEL FLATLIST */}
      <Animated.FlatList
        ref={flatListRef}
        data={extendedSlides}
        keyExtractor={(_item, index) => `banner-slide-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={styles.flatListContent}
        initialScrollIndex={slides.length > 1 ? 1 : 0}
        getItemLayout={(_data, index) => ({
          length: cardWidth,
          offset: cardWidth * index,
          index
        })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={renderSlideItem}
      />

      {/* ANIMATED PAGINATION PILLS */}
      <View style={styles.dotRow}>
        {slides.map((_, i) => {
          const isActive = activeIndex === i;

          return (
            <View
              key={`dot-${i}`}
              style={[
                styles.dot,
                isActive ? styles.dotActive : styles.dotInactive
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14
  },
  flatListContent: {
    alignItems: 'center'
  },
  slideOuter: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroCard: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 142,
    position: 'relative',
    ...shadows.card
  },
  cardPressable: {
    padding: 16,
    minHeight: 142,
    justifyContent: 'space-between',
    width: '100%'
  },
  ambientGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.12
  },
  heroTextContent: {
    gap: 4,
    zIndex: 2
  },
  heroTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radius.pill,
    marginBottom: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)'
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  heroSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
    maxWidth: '85%'
  },
  heroShopBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: 8,
    ...shadows.sm
  },
  heroShopText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '900'
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10
  },
  dot: {
    height: 6,
    borderRadius: 3,
    transitionProperty: 'all',
    transitionDuration: '250ms'
  } as any,
  dotActive: {
    width: 20,
    backgroundColor: colors.primary
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.border
  }
});

export const PromoBannerCarousel = React.memo(PromoBannerCarouselBase);

