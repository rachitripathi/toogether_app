// Kept as a single route file (not location-picker.native.tsx + location-picker.tsx)
// because expo-router's route discovery bundles every app/ file it matches into the
// web/SSR manifest directly, ignoring Metro's usual per-platform extension resolution
// — a .native.tsx route pulled react-native-maps into the web build and broke `expo
// export --platform web`. Splitting one level down, as a normal component import,
// lets Metro's platform resolution do its job like it always does for components.
export { default } from '@/components/LocationPickerScreen';
