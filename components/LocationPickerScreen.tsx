import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';
import { useLocationPickerStore } from '@/store/locationPickerStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Web build has no native map module — this stand-in still returns whatever
// coordinate the picker opened with, so "use mine" (fetched before opening,
// on the calling screen) survives round-tripping through this route on web.
export default function LocationPickerScreen() {
  const insets = useSafeAreaInsets();
  const coordinate = useLocationPickerStore((state) => state.initialCoordinate);
  const resolve = useLocationPickerStore((state) => state.resolve);

  const confirm = () => {
    if (!coordinate) return;
    resolve(coordinate);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', flex: 1 }}>Pin exact location</Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Ionicons name="map-outline" size={42} color={colors.skyDark} />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>
          Map pinning opens on phone preview
        </Text>
        <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 22 }}>
          Web preview cannot load the native map module. Open this on a device to drop a pin.
        </Text>
        {coordinate ? (
          <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'center' }}>
            {coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}
          </Text>
        ) : null}
      </View>

      <View style={{ padding: 16, backgroundColor: '#FFFFFF' }}>
        <GradientButton label="Done" onPress={confirm} fullWidth disabled={!coordinate} />
      </View>
    </View>
  );
}
