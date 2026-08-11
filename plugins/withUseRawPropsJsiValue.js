const { withMainApplication } = require('expo/config-plugins');

const IMPORT_LINE = 'import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative';
const OVERRIDE_SNIPPET = `    com.facebook.react.internal.featureflags.ReactNativeFeatureFlags.override(object : com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsDefaults() {
      override fun useRawPropsJsiValue(): Boolean = true
    })
    loadReactNative(this)`;

/**
 * react-native-vision-camera v5 / react-native-vision-camera-face-detector render
 * Nitro Views whose props (e.g. the camera's `outputs`) are HybridObjects, not
 * plain values. React Native's default prop pipeline serializes props through
 * folly::dynamic, which can't represent a HybridObject and crashes with
 * "Cannot cast dynamic to a jsi::Value type" the moment the Camera view mounts.
 * The `useRawPropsJsiValue` flag is native-only (no JS-level override reaches
 * it), so it must be set here, before the RN runtime loads.
 */
module.exports = function withUseRawPropsJsiValue(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withUseRawPropsJsiValue expects a Kotlin MainApplication.kt');
    }

    let contents = config.modResults.contents;

    if (contents.includes('useRawPropsJsiValue')) {
      return config;
    }

    if (!contents.includes(IMPORT_LINE) || !contents.includes('loadReactNative(this)')) {
      throw new Error(
        'withUseRawPropsJsiValue: expected markers not found in MainApplication.kt — the Expo-generated template may have changed.'
      );
    }

    contents = contents.replace('loadReactNative(this)', OVERRIDE_SNIPPET);
    config.modResults.contents = contents;
    return config;
  });
};
