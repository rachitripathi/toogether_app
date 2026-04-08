import { Redirect } from 'expo-router';
import { useApp } from '@/providers/AppProvider';

export default function Index() {
  const { isOnboardingComplete, currentUser } = useApp();

  if (!isOnboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  if (!currentUser) {
    return <Redirect href="/auth" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
