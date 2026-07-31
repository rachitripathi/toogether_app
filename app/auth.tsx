import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { SuccessSheet } from '@/components/SuccessSheet';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import loginIllustration from '@/assets/auth/login-illustration.png';
import successIllustration from '@/assets/auth/success-illustration.png';

type Mode = 'login' | 'signup';
type SuccessMode = 'login' | 'signup' | null;

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMode, setSuccessMode] = useState<SuccessMode>(null);
  const { login, signup, socialAuth, devAppMode, currentUser } = useApp();
  const insets = useSafeAreaInsets();

  // Safety net: Supabase's signInWithPassword() has been observed to leave the
  // caller's promise hanging even after it already created the session and
  // fired onAuthStateChange (confirmed via server logs showing 200s on every
  // attempt while the app kept showing a timeout error). currentUser flips
  // true from that background event regardless, so watch it directly instead
  // of relying solely on handleEmailAuth's own promise ever resolving.
  useEffect(() => {
    if (currentUser && successMode === null) {
      setError(null);
      setLoading(false);
      setSuccessMode(mode === 'signup' ? 'signup' : 'login');
    }
  }, [currentUser]);

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
        setSuccessMode('signup');
        return;
      }

      setSuccessMode('login');
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

  const dismissSuccess = () => {
    const wasSignup = successMode === 'signup';
    setSuccessMode(null);
    router.replace(wasSignup ? '/new-user-profile' : '/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScrollView
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
          contentContainerStyle={{
            padding: 24,
            paddingTop: insets.top + 12,
            gap: 14,
            paddingBottom: Math.max(insets.bottom, 16) + 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 132,
                height: 132,
                borderRadius: 66,
                backgroundColor: '#FFF6EA',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Image source={loginIllustration} style={{ width: 132, height: 132 }} resizeMode="cover" />
            </View>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#1A1A2E', textAlign: 'center' }}>
              {mode === 'login' ? 'Welcome back 👋' : 'Create your account 🎉'}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7490', marginTop: 6, textAlign: 'center' }}>
              {mode === 'login'
                ? 'Enter your details to access your account'
                : "Let's get your plans started in a minute"}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: '#F1F2F6',
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
              <Text style={{ color: '#1A1A2E', fontWeight: '700', fontSize: 13 }}>Forgot Password</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}

          <GradientButton
            label={loading ? '' : mode === 'login' ? 'Login' : 'Create Account'}
            onPress={handleEmailAuth}
            disabled={loading}
            fullWidth
            variant="dark"
            icon={loading ? <ActivityIndicator color="#FFFFFF" /> : undefined}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>or continue with</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
            <Pressable
              disabled
              onPress={() => handleSocialAuth('google')}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                opacity: 0.55,
              }}
            >
              <Ionicons name="logo-google" size={22} color="#9CA3AF" />
            </Pressable>

            <Pressable
              disabled
              onPress={() => handleSocialAuth('apple')}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#4B5563',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.55,
              }}
            >
              <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </ScrollView>
      </View>

      <SuccessSheet
        visible={successMode !== null}
        image={successIllustration}
        title={successMode === 'signup' ? 'Account Created' : 'Login Successful'}
        subtitle={
          successMode === 'signup'
            ? "You're all set, let's finish your profile"
            : 'Everything looks good, moving you ahead'
        }
        buttonLabel="Got it"
        onDismiss={dismissSuccess}
      />
    </KeyboardAvoidingView>
  );
}
