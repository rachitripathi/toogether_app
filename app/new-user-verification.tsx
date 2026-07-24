import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '@/components/GradientButton';
import { colors, gradients } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const benefits = [
  { icon: 'flash' as const, text: 'Hosts can trust your join requests faster', color: '#7C3AED' },
  { icon: 'shield-checkmark' as const, text: 'Your profile gets a visible verified badge', color: '#0369A1' },
  { icon: 'trending-up' as const, text: 'Future discovery boosts prioritize trusted accounts', color: '#D97706' },
];

export default function NewUserVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, updateCurrentUser } = useApp();

  if (!currentUser) {
    return null;
  }

  const finish = (verified: boolean) => {
    updateCurrentUser({ verified });
    router.replace('/(tabs)/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <LinearGradient
        colors={['#78350F', '#B45309']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
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
              <Ionicons name="shield-checkmark-outline" size={36} color="#FFD700" />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 32 }}>
              Get verified
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 21 }}>
              Optional, but recommended before joining your first plan.
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Why it matters</Text>
          {benefits.map((benefit) => (
            <View key={benefit.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${benefit.color}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={benefit.icon} size={19} color={benefit.color} />
              </View>
              <Text style={{ color: colors.text, lineHeight: 21, flex: 1 }}>{benefit.text}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            backgroundColor: '#FFF7E8',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#FDE7B3',
            padding: 16,
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <Ionicons name="information-circle-outline" size={20} color="#B45309" style={{ marginTop: 1 }} />
          <Text style={{ color: '#92400E', lineHeight: 21, flex: 1, fontSize: 13 }}>
            This is a demo verification — no real ID is required. In the real app, Toogether would verify through social or phone.
          </Text>
        </View>

        <GradientButton label="Get verified" onPress={() => finish(true)} fullWidth />
        <Pressable onPress={() => finish(false)} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: colors.muted, fontWeight: '900' }}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
