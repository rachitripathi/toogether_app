import 'react-native-url-polyfill/auto';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, Text, View } from 'react-native';
import 'react-native-reanimated';
import { AppProvider, useApp } from '@/providers/AppProvider';
import AuthProvider from '@/providers/auth-provider';
import { GradientButton } from '@/components/GradientButton';
import { SuccessToast } from '@/components/SuccessToast';
import { colors } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function VerificationPrompt() {
  const insets = useSafeAreaInsets();
  const { currentUser, shouldShowVerificationPrompt, dismissVerificationPrompt } = useApp();

  if (!currentUser || currentUser.verified || !shouldShowVerificationPrompt) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible={shouldShowVerificationPrompt} onRequestClose={dismissVerificationPrompt}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(12, 18, 38, 0.45)',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: insets.top + 20,
          paddingBottom: Math.max(insets.bottom, 20),
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            padding: 24,
            gap: 18,
          }}
        >
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 30 }}>Verified gets you seen faster</Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>
              Verify your account, {currentUser.name.split(' ')[0]}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 22 }}>
              Verified profiles feel safer to join, usually get better reach, and make hosts more likely to approve requests quickly.
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {[
              'Higher trust when people open your profile',
              'Better chance of getting accepted into plans',
              'Stronger visibility once discovery boosts are enabled',
            ].map((item) => (
              <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
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
                  <Text style={{ color: '#15803D', fontWeight: '900' }}>+</Text>
                </View>
                <Text style={{ flex: 1, color: colors.text, lineHeight: 21 }}>{item}</Text>
              </View>
            ))}
          </View>

          <GradientButton label="Got it" onPress={dismissVerificationPrompt} fullWidth />
          <Pressable onPress={dismissVerificationPrompt} style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontWeight: '700' }}>Verify later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="new-user-profile" />
          <Stack.Screen name="new-user-verification" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="create-event" options={{ presentation: 'modal' }} />
          <Stack.Screen name="verification" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile-plans/[section]" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="user/[id]" />
        </Stack>
        <VerificationPrompt />
        <SuccessToast />
        <StatusBar style="dark" />
      </AppProvider>
    </AuthProvider>
  );
}
