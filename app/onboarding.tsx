import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/Icon';
import { useApp } from '@/providers/AppProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect } from 'react-native-svg';

const LIFT_SHADOW = {
  shadowColor: '#FF6A00',
  shadowOpacity: 0.32,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 12 },
  elevation: 6,
};

// A few subtle shapes behind each illustration: a faint orange glow plus three small accents
// in the art's palette. Positions are fractions of the art area; `mirror` flips them
// horizontally so neighbouring slides don't look identical.
function IntroShapes({ width, height, mirror }: { width: number; height: number; mirror: boolean }) {
  const { colors, scheme } = useTheme();
  if (!width || !height) return null;
  const x = (f: number) => (mirror ? 1 - f : f) * width;
  const y = (f: number) => f * height;
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Circle
        cx={x(0.5)}
        cy={y(0.5)}
        r={Math.min(width, height) * 0.44}
        fill={colors.primary}
        opacity={scheme === 'dark' ? 0.08 : 0.05}
      />
      <Circle cx={x(0.1)} cy={y(0.12)} r={7} stroke="#7C8CFF" strokeWidth={2} fill="none" opacity={0.45} />
      <Circle cx={x(0.9)} cy={y(0.88)} r={4} fill="#FFC93C" opacity={0.6} />
      <Rect x={x(0.86) - 5} y={y(0.1) - 1} width={10} height={2} rx={1} fill={colors.primary} opacity={0.4} />
      <Rect x={x(0.86) - 1} y={y(0.1) - 5} width={2} height={10} rx={1} fill={colors.primary} opacity={0.4} />
    </Svg>
  );
}

const slides = [
  {
    key: 'discover',
    image: require('@/assets/onboarding/intro-1.png'),
    title: 'Discover plans happening',
    highlight: 'nearby',
    subtitle: 'No dead group chats. Just real people making real plans around you.',
  },
  {
    key: 'join',
    image: require('@/assets/onboarding/intro-2.png'),
    title: 'Request to join,',
    highlight: 'get approved',
    subtitle: 'Hosts see who wants in and approve the people they want along. Safe by default.',
  },
  {
    key: 'meet',
    image: require('@/assets/onboarding/intro-3.png'),
    title: 'Meet people you',
    highlight: 'click with',
    subtitle: 'Chat with the group, show up, and turn good plans into your crew.',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  // Size of the art area (everything above the text), measured once; same on every slide.
  const [artArea, setArtArea] = useState({ width: 0, height: 0 });
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { completeOnboarding } = useApp();
  const { colors, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  // Each slide is a column: Skip row, square art, any spare height, title/subtitle, then room
  // for the absolutely-positioned dots + Next row. The art is nearly full width, shrunk only on
  // short phones so the text (~230px: two-line title + up to three-line subtitle) still fits.
  const SKIP_ROW_HEIGHT = 44;
  const CONTROLS_BOTTOM = Math.max(insets.bottom, 16) + 16;
  const CONTROLS_SPACE = CONTROLS_BOTTOM + 56 + 24;
  const TEXT_BLOCK_HEIGHT = 230;
  const ART_SIZE = Math.min(
    SCREEN_WIDTH - 16,
    SCREEN_HEIGHT - insets.top - SKIP_ROW_HEIGHT - CONTROLS_SPACE - TEXT_BLOCK_HEIGHT
  );

  const finish = () => {
    completeOnboarding();
    router.replace('/auth');
  };

  const goToSlide = (nextIndex: number) => {
    scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
    setIndex(nextIndex);
  };

  const handleNext = () => {
    if (index === slides.length - 1) {
      finish();
    } else {
      goToSlide(index + 1);
    }
  };

  const isLast = index === slides.length - 1;
  // Once the art area is measured, the collage grows to fill it (square, near full width);
  // until then the estimate above keeps the first frame from jumping much.
  const artSize = artArea.height ? Math.min(SCREEN_WIDTH - 16, artArea.height - 8) : ART_SIZE;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setIndex(newIndex);
          }}
          style={{ flex: 1 }}
        >
          {slides.map((slide, slideIndex) => (
            <View
              key={slide.key}
              style={{ width: SCREEN_WIDTH, flex: 1, paddingTop: insets.top + SKIP_ROW_HEIGHT, paddingBottom: CONTROLS_SPACE }}
            >
              {/* Art area takes all spare height; the collage is centred in it over the shapes. */}
              <View
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                onLayout={
                  slideIndex === 0
                    ? (e) => {
                        const { width, height } = e.nativeEvent.layout;
                        if (width !== artArea.width || height !== artArea.height) setArtArea({ width, height });
                      }
                    : undefined
                }
              >
                <IntroShapes width={artArea.width} height={artArea.height} mirror={slideIndex % 2 === 1} />
                <Image source={slide.image} style={{ width: artSize, height: artSize }} resizeMode="contain" />
              </View>

              <View style={{ paddingHorizontal: 28, paddingTop: 8 }}>
                <Text style={{ fontSize: 36, fontWeight: '900', color: colors.text, lineHeight: 46, letterSpacing: -0.8, paddingBottom: 2 }}>
                  {slide.title} <Text style={{ color: colors.primary }}>{slide.highlight}</Text>
                </Text>
                <Text style={{ fontSize: 18, color: colors.muted, marginTop: 14, lineHeight: 26, fontWeight: '500' }}>
                  {slide.subtitle}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top,
            height: SKIP_ROW_HEIGHT,
            right: 20,
            left: 20,
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          {!isLast ? (
            <Pressable onPress={finish} hitSlop={10} style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
              <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 15 }}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 28,
            right: 28,
            bottom: CONTROLS_BOTTOM,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {slides.map((_, dotIndex) => (
              <Pressable key={dotIndex} onPress={() => goToSlide(dotIndex)}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: dotIndex === index ? colors.primary : colors.border,
                  }}
                />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleNext} hitSlop={8}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                ...LIFT_SHADOW,
              }}
            >
              <Icon name={isLast ? 'checkmark' : 'arrow-forward'} size={24} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
