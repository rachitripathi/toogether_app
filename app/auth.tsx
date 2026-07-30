import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { colors, gradients } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { getSelectableAppModes, type DevAppMode } from '@/lib/monetisation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, signup, socialAuth, devAppMode, setDevAppMode } = useApp();
  const insets = useSafeAreaInsets();
  const appModeCopy: Record<DevAppMode, { label: string; helper: string }> = {
    free: { label: 'Free version', helper: 'No credits or paywall UI' },
    paid: { label: 'Paid version', helper: 'Credits enabled after free limits' },
    'limit-hit': { label: 'Paywall demo', helper: 'Starts at limits with 0 credits' },
    'new-user': { label: 'New user demo', helper: 'Profile setup and verification prompts' },
  };
  const appModes = getSelectableAppModes().map((id) => ({ id, ...appModeCopy[id] }));

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === 'login' ? await login(email.trim(), password) : await signup(email.trim(), password);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (mode === 'signup') {
        if (result.needsEmailConfirmation) {
          setError('Account created. Check your email to confirm it, then log in.');
          setMode('login');
          return;
        }
        router.replace('/new-user-profile');
        return;
      }

      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = (provider: 'google' | 'apple') => {
    socialAuth(provider, mode);
    if (devAppMode === 'new-user') {
      router.replace('/new-user-profile');
      return;
    }
    router.replace('/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <LinearGradient colors={[...gradients.hero]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 22, paddingBottom: 28 }}>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '900' }}>Toogether</Text>
          <Text style={{ color: colors.skyDark, marginTop: 8, fontSize: 15, fontWeight: '700' }}>
            Your next plan is one tap away.
          </Text>
        </View>

        <ScrollView
          style={{
            flex: 1,
            backgroundColor: colors.page,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }}
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: Math.max(insets.bottom, 16) + 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: '#EEF2F7',
              borderRadius: 18,
              padding: 4,
              flexDirection: 'row',
            }}
          >
            {(['login', 'signup'] as Mode[]).map((item) => {
              const active = item === mode;
              return (
                <Pressable
                  key={item}
                  onPress={() => handleModeChange(item)}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    backgroundColor: active ? '#FFFFFF' : 'transparent',
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: active ? '#1A1A2E' : '#7A8093', fontWeight: '800' }}>
                    {item === 'login' ? 'Log In' : 'Sign Up'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
          />

          {mode === 'login' ? (
            <Pressable onPress={() => router.push('/reset-password')} style={{ alignSelf: 'flex-end' }}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Forgot password?</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}

          <GradientButton
            label={loading ? '' : mode === 'login' ? 'Log In' : 'Create Account'}
            onPress={handleEmailAuth}
            disabled={loading}
            fullWidth
            icon={loading ? <ActivityIndicator color={colors.text} /> : undefined}
          />

          {appModes.length ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="construct-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.text, fontWeight: '900' }}>Choose app version</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
                Temporary login switch for reviewing the hidden paid flow before launch.
              </Text>
              <View style={{ gap: 8 }}>
                {appModes.map((item) => {
                  const active = item.id === devAppMode;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setDevAppMode(item.id)}
                      style={{
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? '#E8F4FF' : '#FFFFFF',
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Ionicons
                        name={active ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={active ? colors.primary : colors.muted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '800' }}>{item.label}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{item.helper}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Pressable
            disabled
            onPress={() => handleSocialAuth('google')}
            style={{
              minHeight: 56,
              borderRadius: 24,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              opacity: 0.55,
            }}
          >
            <Ionicons name="logo-google" size={18} color="#9CA3AF" />
            <Text style={{ color: '#9CA3AF', fontSize: 16, fontWeight: '800' }}>
              {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
            </Text>
          </Pressable>

          <Pressable
            disabled
            onPress={() => handleSocialAuth('apple')}
            style={{
              minHeight: 56,
              borderRadius: 24,
              backgroundColor: '#4B5563',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              opacity: 0.55,
            }}
          >
            <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
              {mode === 'login' ? 'Continue with Apple' : 'Sign up with Apple'}
            </Text>
          </Pressable>

          <Text style={{ color: '#98A2B3', fontSize: 12, textAlign: 'center' }}>
            Google and Apple sign-in are coming soon. Google and Apple usually do not provide reliable gender data,
            so the app will still ask you to confirm your profile after sign-in.
          </Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
