import { useEffect, useRef } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/providers/AppProvider';
import { colors, shadow } from '@/lib/theme';
import successIllustration from '@/assets/auth/login-illustration.png';

const OFFSCREEN_Y = 160;
const VISIBLE_DURATION_MS = 1600;

export function SuccessToast() {
  const { successToast, clearSuccessToast } = useApp();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!successToast) return;

    translateY.setValue(OFFSCREEN_Y);
    opacity.setValue(0);

    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 16, mass: 0.9 }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.delay(VISIBLE_DURATION_MS),
      Animated.parallel([
        Animated.timing(translateY, { toValue: OFFSCREEN_Y, duration: 260, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
    ]);

    sequence.start(({ finished }) => {
      if (finished) clearSuccessToast();
    });

    return () => sequence.stop();
  }, [successToast]);

  if (!successToast) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 100,
        alignItems: 'center',
        paddingHorizontal: 24,
      }}
    >
      <Animated.View
        style={{
          transform: [{ translateY }],
          opacity,
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          maxWidth: 380,
          ...shadow.lift,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: '#FFF6EA',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image source={successIllustration} style={{ width: 52, height: 52 }} resizeMode="cover" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{successToast.title}</Text>
          <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{successToast.subtitle}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
