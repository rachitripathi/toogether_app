import { Redirect } from 'expo-router';
import { Image, View } from 'react-native';
import { useApp } from '@/providers/AppProvider';
import splashIllustration from '@/assets/images/splash-icon.png';

export default function Index() {
  const { isAppReady, isOnboardingComplete, currentUser } = useApp();

  // Wait until we know both whether onboarding was already completed and whether
  // there's a logged-in session, so we never briefly redirect an already-logged-in
  // user to /auth (which was firing the "successful login" flow every cold start).
  // Expo Go doesn't render the native expo-splash-screen config (that only applies
  // to a prebuilt dev client / production build), so this doubles as the visible
  // splash while running in Expo Go.
  if (!isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <Image source={splashIllustration} style={{ width: 220, height: 147 }} resizeMode="contain" />
      </View>
    );
  }

  if (!isOnboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  if (!currentUser) {
    return <Redirect href="/auth" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
