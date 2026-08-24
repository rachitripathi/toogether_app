import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/Icon';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slide1Illustration from '@/assets/onboarding/slide-1.svg';
import Slide2Illustration from '@/assets/onboarding/slide-2.svg';
import Slide3Illustration from '@/assets/onboarding/slide-3.svg';

// This screen's SVG illustrations bake in their own light backgrounds, so it's kept
// intentionally light-invariant rather than following the app theme — flipping the
// surrounding chrome dark while the art stays light would look broken, not themed.
const HERO_GRADIENT = ['#FFFFFF', '#EFF6FF'] as const;
const LIFT_SHADOW = {
  shadowColor: '#9AACDF',
  shadowOpacity: 0.26,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 12 },
  elevation: 6,
};

const slides = [
  {
    key: 'discover',
    Illustration: Slide1Illustration,
    title: 'Discover spontaneous plans',
    subtitle: 'No dead group chats. Just real people making real plans nearby.',
    accent: ['#FFDE7A', '#F5B921'] as const,
    iconColor: '#1A1A2E',
  },
  {
    key: 'create',
    Illustration: Slide2Illustration,
    title: 'Create the vibe you want',
    subtitle: 'Movie nights, chai runs, jam sessions, drives, and anything in between.',
    accent: ['#FF9294', '#F65C6E'] as const,
    iconColor: '#FFFFFF',
  },
  {
    key: 'meet',
    Illustration: Slide3Illustration,
    title: 'Meet people you click with',
    subtitle: 'Every plan is a chance to find your crew and keep the momentum going.',
    accent: ['#8B5CF6', '#5D2ED2'] as const,
    iconColor: '#FFFFFF',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { completeOnboarding } = useApp();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const IMAGE_HEIGHT = Math.round(SCREEN_HEIGHT * 0.68);

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
  const current = slides[index];

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F7FB' }}>
      <LinearGradient colors={HERO_GRADIENT} style={{ flex: 1 }}>
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
          {slides.map((slide) => (
            <View key={slide.key} style={{ width: SCREEN_WIDTH, flex: 1 }}>
              <View style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT, overflow: 'hidden' }}>
                <slide.Illustration
                  width={SCREEN_WIDTH}
                  height={IMAGE_HEIGHT}
                  preserveAspectRatio="xMidYMid slice"
                />
              </View>

              <View style={{ paddingHorizontal: 28, paddingTop: 28 }}>
                <Text style={{ fontSize: 31, fontWeight: '900', color: '#1A1A2E', lineHeight: 38 }}>
                  {slide.title}
                </Text>
                <Text style={{ fontSize: 16, color: '#667085', marginTop: 12, lineHeight: 24 }}>
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
            top: insets.top + 16,
            right: 20,
            left: 20,
            alignItems: 'flex-end',
          }}
        >
          {!isLast ? (
            <Pressable
              onPress={finish}
              style={{
                backgroundColor: 'rgba(255,255,255,0.5)',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: '#1A1A2E', fontWeight: '800' }}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 28,
            right: 28,
            bottom: Math.max(insets.bottom, 16) + 20,
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
                    backgroundColor: dotIndex === index ? '#1A1A2E' : '#D0D5DD',
                  }}
                />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleNext} hitSlop={8}>
            <LinearGradient
              colors={[...current.accent]}
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
              <Icon name={isLast ? 'checkmark' : 'arrow-forward'} size={24} color={current.iconColor} />
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}
