import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const { socialAuth } = useApp();
  const insets = useSafeAreaInsets();

  const handleSocialAuth = (provider: 'google' | 'apple') => {
    socialAuth(provider, mode);
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
                  onPress={() => setMode(item)}
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

          <Text style={{ color: '#667085', lineHeight: 22 }}>
            {mode === 'login'
              ? 'Continue with the account provider you want to use in the app.'
              : 'Create your account using Google or Apple. We do not show generic signup anymore.'}
          </Text>

          <Pressable
            onPress={() => handleSocialAuth('google')}
            style={{
              minHeight: 56,
              borderRadius: 24,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Ionicons name="logo-google" size={18} color="#EA4335" />
            <Text style={{ color: '#1F2937', fontSize: 16, fontWeight: '800' }}>
              {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSocialAuth('apple')}
            style={{
              minHeight: 56,
              borderRadius: 24,
              backgroundColor: '#111827',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
              {mode === 'login' ? 'Continue with Apple' : 'Sign up with Apple'}
            </Text>
          </Pressable>

          <Text style={{ color: '#98A2B3', fontSize: 12, textAlign: 'center' }}>
            Google and Apple usually do not provide reliable gender data. For women-only plans, the app should use a
            profile field you confirm after sign-in.
          </Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
