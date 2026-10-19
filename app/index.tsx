import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useApp } from '@/providers/AppProvider';
import { useTheme } from '@/providers/ThemeProvider';
import OpenPlansWordmark from '@/assets/brand/open-plans-wordmark.svg';

export default function Index() {
  const { isAppReady, currentUser, lastRoute } = useApp();
  const { colors } = useTheme();

  // Wait until we know whether there's a logged-in session, so we never briefly redirect an
  // already-logged-in user to /auth (which was firing the "successful login" flow every cold
  // start).
  // Expo Go doesn't render the native expo-splash-screen config (that only applies
  // to a prebuilt dev client / production build), so this doubles as the visible
  // splash while running in Expo Go — matches app.json's splash-screen light/dark
  // background pair so there's no flash between the two.
  if (!isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}>
        <OpenPlansWordmark width={200} height={121} />
      </View>
    );
  }

  // Anyone not logged in sees the intro slides first, every launch (not just the first
  // install). The slides then lead to /auth.
  if (!currentUser) {
    return <Redirect href="/onboarding" />;
  }

  // Every cold start lands here at "/" with the navigation stack gone. If Android
  // reclaimed the process in the background and the user came back from recents,
  // lastRoute is their last screen, so the app doesn't read as "reset itself." After a
  // swipe out of recents (or on iOS / Expo Go) it is null, and the user starts on Home.
  return <Redirect href={(lastRoute ?? '/(tabs)/home') as never} />;
}
