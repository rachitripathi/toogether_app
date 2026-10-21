import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';

type NotificationsModule = typeof import('expo-notifications');

// expo-notifications can't even be imported in some runtimes, so it's loaded here, lazily,
// only where it works. Importing it:
// - registers a push-token listener as a side effect, which throws on Android in Expo Go
//   (remote push was removed from Expo Go in SDK 53);
// - since SDK 58, loads the Android-only ExpoTopicSubscriptionModule native module, which
//   Expo Go and any dev build made before the SDK 58 upgrade don't contain.
// So rather than guessing the runtime, check that native module is actually in the binary.
// Everything else (in-app inbox, settings) works without notifications; callers get null.
let cached: NotificationsModule | null | undefined;

export function loadNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const nativeMissing = Platform.OS === 'android' && !requireOptionalNativeModule('ExpoTopicSubscriptionModule');
  cached = isExpoGo || nativeMissing ? null : require('expo-notifications');
  return cached ?? null;
}
