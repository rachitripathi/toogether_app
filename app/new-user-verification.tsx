import { Pressable, ScrollView, Text, View } from 'react-native';
import { CtaFill } from '@/components/CtaFill';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { GradientButton } from '@/components/GradientButton';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useVerificationDraftStore } from '@/store/verificationDraftStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Icon colors are theme keys, not hex: fixed dark hues vanished on the dark-mode card.
const benefits = [
  { icon: 'flash' as const, text: 'Hosts can trust your join requests faster', tone: 'secondary' as const },
  { icon: 'shield-checkmark' as const, text: 'Your profile gets a visible verified badge', tone: 'verified' as const },
  { icon: 'trending-up' as const, text: 'Future discovery boosts prioritize trusted accounts', tone: 'warning' as const },
];

export default function NewUserVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, updateCurrentUser } = useApp();
  const { colors } = useTheme();
  const resetDraft = useVerificationDraftStore((s) => s.reset);

  if (!currentUser) {
    return null;
  }

  const finish = (verified: boolean) => {
    updateCurrentUser({ verified }).catch(() => {});
    router.replace('/(tabs)/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ backgroundColor: colors.primary }}>
        <CtaFill variant="header" />
        <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 28, gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <VerifiedBadge size={40} color="#FFFFFF" />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 32 }}>
              Get verified
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', textAlign: 'center', lineHeight: 21, fontSize: 14 }}>
              {'Optional, but recommended before\njoining your first plan.'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 14 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Why it matters</Text>
          {benefits.map((benefit) => (
            <View key={benefit.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inset, alignItems: 'center', justifyContent: 'center' }}>
                {benefit.icon === 'shield-checkmark' ? (
                  <VerifiedBadge size={19} color={colors[benefit.tone]} />
                ) : (
                  <Icon name={benefit.icon} size={19} color={colors[benefit.tone]} />
                )}
              </View>
              <Text style={{ color: colors.text, lineHeight: 21, flex: 1 }}>{benefit.text}</Text>
            </View>
          ))}
        </View>

        <GradientButton
          label="Get verified"
          onPress={() => {
            resetDraft();
            router.push('/verification/documents');
          }}
          fullWidth
        />
        <Pressable onPress={() => finish(false)} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: colors.muted, fontWeight: '900' }}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
