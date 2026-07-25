// Centralized on/off switch for every developer/demo-only affordance in the app —
// the "Choose app version" account switcher on the login screen, the "this is a demo
// verification" disclaimer, and anything else added later for testing screens/flows
// that shouldn't be visible to real users.
//
// Controlled by EXPO_PUBLIC_DEV_TOOLS_ENABLED in .env:
//   EXPO_PUBLIC_DEV_TOOLS_ENABLED=true   -> force on (any build)
//   EXPO_PUBLIC_DEV_TOOLS_ENABLED=false  -> force off (any build)
//   unset                                -> defaults to on in dev builds, off in release builds
//
// See DEV_TOOLS.md for the full list of what this gates and how to use it.
const envOverride = process.env.EXPO_PUBLIC_DEV_TOOLS_ENABLED;

export const DEV_TOOLS_ENABLED: boolean =
  envOverride !== undefined ? envOverride === 'true' : __DEV__;
