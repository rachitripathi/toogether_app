import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AppProvider } from '@/providers/AppProvider';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F7FB' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-event" options={{ presentation: 'modal' }} />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="user/[id]" />
      </Stack>
      <StatusBar style="dark" />
    </AppProvider>
  );
}
