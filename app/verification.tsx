import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '@/components/GradientButton';
import { colors, gradients } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const perks = [
  { icon: 'flash' as const, label: 'Hosts trust your requests faster', color: '#7C3AED' },
  { icon: 'shield-checkmark' as const, label: 'Visible verified badge on your profile', color: '#0369A1' },
  { icon: 'star' as const, label: 'Priority in future plan discovery', color: '#D97706' },
  { icon: 'people' as const, label: 'Access to verified-only plans', color: '#16A34A' },
];

const benefits = [
  'Hosts can trust your join requests faster',
  'Your profile gets a visible verified badge',
  'Future discovery boosts can prioritize trusted accounts',
];

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, updateCurrentUser } = useApp();

  if (!currentUser) {
    return null;
  }

  if (currentUser.verified) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <LinearGradient colors={[...gradients.verified]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 32 }}>
            <Pressable
              onPress={() => router.back()}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}
            >
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            </Pressable>

            <View style={{ alignItems: 'center', gap: 14 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark" size={42} color="#FFFFFF" />
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900', textAlign: 'center', lineHeight: 34 }}>
                {"You're in the trusted circle"}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 22, fontSize: 15 }}>
                Your account is verified. Hosts can trust you and you have access to exclusive perks.
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 16 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>Your verified perks</Text>
            {perks.map((perk) => (
              <View key={perk.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${perk.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={perk.icon} size={20} color={perk.color} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1, lineHeight: 20 }}>{perk.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ backgroundColor: '#DCFCE7', borderRadius: 20, borderWidth: 1, borderColor: '#86EFAC', padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#15803D', fontWeight: '800' }}>Verification active</Text>
              <Text style={{ color: '#16A34A', fontSize: 12, marginTop: 2 }}>
                Your badge is visible on your profile and join requests.
              </Text>
            </View>
          </View>

          <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: colors.muted, fontWeight: '800' }}>Back to home</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Get Verified</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View style={{ backgroundColor: '#FFF7E8', borderRadius: 28, borderWidth: 1, borderColor: '#FDE7B3', padding: 22, gap: 14 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark-outline" size={30} color="#B45309" />
          </View>
          <Text style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '900' }}>
            Verified profiles feel safer to meet.
          </Text>
          <Text style={{ color: colors.text, lineHeight: 22 }}>
            Verification is optional, but it explains why Toogether asks people to build trust before meeting offline.
          </Text>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Why get verified?</Text>
          {benefits.map((item) => (
            <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Ionicons name="checkmark-circle" size={19} color="#15803D" style={{ marginTop: 1 }} />
              <Text style={{ color: colors.text, lineHeight: 21, flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>

        <GradientButton
          label="Get verified now"
          onPress={() => {
            updateCurrentUser({ verified: true });
            router.replace('/(tabs)/home');
          }}
          fullWidth
        />
        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: colors.muted, fontWeight: '900' }}>Maybe later</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
