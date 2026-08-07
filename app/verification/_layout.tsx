import { Stack } from 'expo-router';

export default function VerificationFlowLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="capture-aadhaar" />
      <Stack.Screen name="liveness" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
