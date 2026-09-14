import { requireOptionalNativeModule } from 'expo';

type LaunchStateModule = {
  wasRestoredBySystem(): boolean;
};

// Android-only native module (android/src/main/java/com/toogether/launchstate). It is absent on
// iOS, on web, and in Expo Go, and all of those get `false`, i.e. they are treated as a fresh launch.
const LaunchState = requireOptionalNativeModule<LaunchStateModule>('LaunchState');

/**
 * True only when Android recreated the app from saved state: the app was still in recents but the
 * system had reclaimed its process in the background. False after the user swiped the app out of
 * recents (Android discards the task's saved state then), on a first launch, and anywhere the native
 * module isn't available.
 */
export function wasRestoredBySystem(): boolean {
  return LaunchState?.wasRestoredBySystem() ?? false;
}
