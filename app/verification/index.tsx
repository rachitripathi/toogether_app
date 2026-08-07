import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '@/components/GradientButton';
import { colors, gradients } from '@/lib/theme';
import { DEV_TOOLS_ENABLED } from '@/lib/devTools';
import { useApp } from '@/providers/AppProvider';
import { useVerificationDraftStore } from '@/store/verificationDraftStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SUPPORT_EMAIL = 'support@toogether.app';

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

function writeToUs(subject: string) {
  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`).catch(() => {});
}

function BackButton({ light }: { light?: boolean }) {
  return (
    <Pressable
      onPress={() => router.back()}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: light ? 'rgba(255,255,255,0.2)' : colors.page,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="arrow-back" size={18} color={light ? '#FFFFFF' : colors.text} />
    </Pressable>
  );
}

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, setVerificationStatusDev } = useApp();
  const resetDraft = useVerificationDraftStore((s) => s.reset);

  if (!currentUser) {
    return null;
  }

  const status = currentUser.verificationStatus ?? (currentUser.verified ? 'approved' : 'unverified');

  if (status === 'approved') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <LinearGradient colors={[...gradients.verified]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 32 }}>
            <View style={{ marginBottom: 20 }}>
              <BackButton light />
            </View>

            <View style={{ alignItems: 'center', gap: 14 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark" size={42} color="#FFFFFF" />
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900', textAlign: 'center', lineHeight: 34 }}>
                {"You're a verified member"}
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

  if (status === 'pending') {
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
          <BackButton />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Verification</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
          <View style={{ backgroundColor: '#FFF7E8', borderRadius: 28, borderWidth: 1, borderColor: '#FDE7B3', padding: 22, gap: 14, alignItems: 'center' }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="hourglass-outline" size={28} color="#B45309" />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center' }}>
              Your documents are under review
            </Text>
            <Text style={{ color: colors.text, lineHeight: 21, textAlign: 'center' }}>
              {currentUser.verificationSubmittedAt
                ? `Submitted ${new Date(currentUser.verificationSubmittedAt).toLocaleDateString()}. `
                : ''}
              We'll notify you as soon as it's reviewed.
            </Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Ionicons name="time-outline" size={20} color={colors.muted} style={{ marginTop: 1 }} />
            <Text style={{ color: colors.text, lineHeight: 20, flex: 1, fontSize: 13 }}>
              Verification can take up to <Text style={{ fontWeight: '800' }}>72 hours</Text>. Thanks for your
              patience — this keeps the community trustworthy.
            </Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>What you'll get</Text>
            {benefits.map((item) => (
              <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name="checkmark-circle" size={19} color="#15803D" style={{ marginTop: 1 }} />
                <Text style={{ color: colors.text, lineHeight: 21, flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => writeToUs('Question about my verification')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Ionicons name="mail-outline" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '800' }}>Write to us</Text>
          </Pressable>

          {DEV_TOOLS_ENABLED ? (
            <View style={{ backgroundColor: '#FFF7E8', borderRadius: 16, borderWidth: 1, borderColor: '#FDE7B3', padding: 14, gap: 10 }}>
              <Text style={{ color: '#92400E', fontWeight: '800', fontSize: 12 }}>
                Dev tools: simulate a review outcome
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setVerificationStatusDev('approved')}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: '#16A34A' }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Approve</Text>
                </Pressable>
                <Pressable
                  onPress={() => setVerificationStatusDev('rejected', 'Your Aadhaar photos were too blurry to read.')}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: colors.danger }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (status === 'rejected') {
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
          <BackButton />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Verification</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
          <View style={{ backgroundColor: '#FFF1F2', borderRadius: 28, borderWidth: 1, borderColor: '#FECDD3', padding: 22, gap: 14, alignItems: 'center' }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close-circle" size={30} color={colors.danger} />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center' }}>
              We couldn't verify your account
            </Text>
            <Text style={{ color: colors.text, lineHeight: 21, textAlign: 'center' }}>
              {currentUser.verificationRejectionReason ??
                "We couldn't confirm your documents. Make sure your Aadhaar and selfie photos are clear, well-lit, and fully visible, then try again."}
            </Text>
          </View>

          <GradientButton
            label="Reapply"
            onPress={() => {
              resetDraft();
              router.push('/verification/capture-aadhaar');
            }}
            fullWidth
          />
          <Pressable
            onPress={() => writeToUs('Help with a rejected verification')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Ionicons name="mail-outline" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '800' }}>Write to us</Text>
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
        <BackButton />
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

        <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Ionicons name="information-circle-outline" size={20} color={colors.muted} style={{ marginTop: 1 }} />
          <Text style={{ color: colors.muted, lineHeight: 20, flex: 1, fontSize: 13 }}>
            You'll take live photos of your Aadhaar card and a quick selfie check — no gallery uploads, so we know
            it's really you, right now.
          </Text>
        </View>

        <GradientButton
          label="Verify now"
          onPress={() => {
            resetDraft();
            router.push('/verification/capture-aadhaar');
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
