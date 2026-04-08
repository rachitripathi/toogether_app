import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { GradientButton } from '@/components/GradientButton';
import { gradients } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const slides = [
  {
    emoji: '🌟',
    title: 'Discover spontaneous plans',
    subtitle: 'No dead group chats. Just real people making real plans nearby.',
  },
  {
    emoji: '🎯',
    title: 'Create the vibe you want',
    subtitle: 'Movie nights, chai runs, jam sessions, drives, and anything in between.',
  },
  {
    emoji: '🤝',
    title: 'Meet people you click with',
    subtitle: 'Every plan is a chance to find your crew and keep the momentum going.',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const { completeOnboarding } = useApp();
  const insets = useSafeAreaInsets();
  const slide = slides[index];

  const finish = () => {
    completeOnboarding();
    router.replace('/auth');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F7FB' }}>
      <LinearGradient colors={[...gradients.hero]} style={{ flex: 1, paddingTop: insets.top + 20 }}>
        <View style={{ paddingHorizontal: 24, alignItems: 'flex-end' }}>
          {index < slides.length - 1 ? (
            <Pressable onPress={finish}>
              <Text style={{ color: 'rgba(255,255,255,0.88)', fontWeight: '700' }}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
          <View
            style={{
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 88 }}>{slide.emoji}</Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: Math.max(insets.bottom, 16) + 20,
            minHeight: 290,
          }}
        >
          <Text style={{ fontSize: 31, fontWeight: '900', color: '#1A1A2E', lineHeight: 38 }}>
            {slide.title}
          </Text>
          <Text style={{ fontSize: 16, color: '#667085', marginTop: 12, lineHeight: 24 }}>
            {slide.subtitle}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 28, marginBottom: 28 }}>
            {slides.map((_, dotIndex) => (
              <View
                key={dotIndex}
                style={{
                  width: dotIndex === index ? 28 : 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: dotIndex === index ? '#6B57FF' : '#D0D5DD',
                }}
              />
            ))}
          </View>

          <GradientButton
            label={index === slides.length - 1 ? 'Get Started' : 'Next'}
            onPress={() => {
              if (index === slides.length - 1) {
                finish();
                return;
              }
              setIndex((value) => value + 1);
            }}
            fullWidth
          />
        </View>
      </LinearGradient>
    </View>
  );
}
