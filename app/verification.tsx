import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { GradientButton } from '@/components/GradientButton';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();

  if (!currentUser) {
    return null;
  }

  const verified = Boolean(currentUser.verified);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.page,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>
          {verified ? 'Verified member' : 'Get verified'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: verified ? '#DFF4E8' : '#FFF7E8',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: verified ? '#BDE7CD' : '#FDE7B3',
            padding: 20,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons
              name={verified ? 'checkmark-circle' : 'shield-checkmark-outline'}
              size={22}
              color={verified ? '#15803D' : '#B45309'}
            />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>
              {verified ? 'You are a verified member' : 'Verification improves trust'}
            </Text>
          </View>
          <Text style={{ color: colors.text, lineHeight: 22 }}>
            {verified
              ? 'Hosts can spot your trusted profile faster, and your account is ready for discovery boosts and future verified-only benefits.'
              : 'A verified badge helps hosts trust your profile, improves your chances of being accepted quickly, and unlocks future reach perks.'}
          </Text>
        </View>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
            {verified ? 'Your verified perks' : 'Why it helps'}
          </Text>
          {[
            'Profiles feel safer and more credible',
            'Join requests are easier for hosts to trust',
            'Better placement once reach boosts go live',
          ].map((item) => (
            <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Ionicons name="checkmark-circle" size={18} color="#15803D" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: colors.text, lineHeight: 21 }}>{item}</Text>
            </View>
          ))}
        </View>

        {!verified ? (
          <GradientButton
            label="Start verification"
            onPress={() => router.push('/(tabs)/profile')}
            fullWidth
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
