import { Stack } from 'expo-router';

export default function VerificationFlowLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="capture" />
    </Stack>
  );
}
