import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '@/components/GradientButton';
import { colors, gradients } from '@/lib/theme';
import { CREDIT_PACKS } from '@/lib/monetisation';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const perks = [
  'Join more plans beyond the free monthly limit',
  'Create extra plans when your monthly slots run out',
  'Unlock attendee lists on any event for 1 credit',
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { getUsageSummary, buyCreditPack } = useApp();
  const usage = getUsageSummary();

  useEffect(() => {
    if (!usage.monetisationEnabled) {
      router.replace('/(tabs)/home');
    }
  }, [usage.monetisationEnabled]);

  if (!usage.monetisationEnabled) {
    return null;
  }

  const isJoinBlocked = usage.joinLimitReached;
  const isCreateBlocked = usage.createLimitReached;

  const headingText = isCreateBlocked
    ? 'Plan creation limit reached'
    : isJoinBlocked
      ? 'Join request limit reached'
      : 'Get more credits';

  const subText = isCreateBlocked
    ? `You've used all ${usage.createLimit} free plan creations this month.`
    : isJoinBlocked
      ? `You've used all ${usage.joinLimit} free join requests this month.`
      : 'Top up your credits to keep discovering plans.';

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <LinearGradient
        colors={[...gradients.hero]}
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 28,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', lineHeight: 32 }}>
              {headingText}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 20 }}>
              {subText}
            </Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 12,
            }}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.14)',
            borderRadius: 20,
            padding: 16,
            gap: 10,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800' }}>
            YOUR BALANCE
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="flash" size={22} color="#FFBE3D" />
            <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900' }}>
              {usage.credits} credits remaining
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              {usage.joinUsed}/{usage.joinLimit} joins used
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              {usage.createUsed}/{usage.createLimit} plans created
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>What credits unlock</Text>
          {perks.map((perk) => (
            <View key={perk} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: '#DCFCE7',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                <Ionicons name="checkmark" size={13} color="#15803D" />
              </View>
              <Text style={{ flex: 1, color: colors.text, lineHeight: 21 }}>{perk}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Pick a credit pack</Text>
          {CREDIT_PACKS.map((pack) => (
            <Pressable
              key={pack.id}
              onPress={() => {
                buyCreditPack(pack.id);
                router.back();
              }}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 18,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                shadowColor: '#D7E6F2',
                shadowOpacity: 0.14,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#EFF6FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="flash" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{pack.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{pack.helper}</Text>
                <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 4 }}>
                  {pack.credits} credits
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15 }}>₹{pack.price}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            backgroundColor: '#F8FAFC',
            borderRadius: 18,
            padding: 16,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
            Credits never expire. Verified users get{' '}
            <Text style={{ fontWeight: '800', color: colors.text }}>5 extra free joins</Text> each month on top
            of the standard limit.
          </Text>
        </View>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: colors.muted, fontWeight: '700' }}>Maybe later</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
