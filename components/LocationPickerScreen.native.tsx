import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';
import { useLocationPickerStore, type MapCoordinate, type MapRegion } from '@/store/locationPickerStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LocationPickerScreen() {
  const insets = useSafeAreaInsets();
  const initialCoordinate = useLocationPickerStore((state) => state.initialCoordinate);
  const initialRegion = useLocationPickerStore((state) => state.initialRegion);
  const resolve = useLocationPickerStore((state) => state.resolve);

  const mapRef = useRef<MapView>(null);
  const [coordinate, setCoordinate] = useState<MapCoordinate | null>(initialCoordinate);
  const [region, setRegion] = useState<MapRegion>(initialRegion);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useMyLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to use your current location.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      const next = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setCoordinate(next);
      // MapView isn't a controlled `region` prop here (so a user's own pan/zoom
      // gestures never fight a re-render) — recentering after "Use mine" has to
      // go through the imperative ref instead of just setting state.
      mapRef.current?.animateToRegion({ ...region, ...next }, 500);
    } catch {
      setError("Couldn't fetch your location. Try again.");
    } finally {
      setLocating(false);
    }
  };

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
        <Pressable onPress={useMyLocation} disabled={locating} style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
          <Text style={{ color: colors.skyDark, fontWeight: '800' }}>{locating ? 'Locating…' : 'Use mine'}</Text>
        </Pressable>
      </View>

      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onPress={(event: MapPressEvent) => setCoordinate(event.nativeEvent.coordinate)}
      >
        {coordinate ? <Marker coordinate={coordinate} /> : null}
      </MapView>

      <View style={{ padding: 16, gap: 10, backgroundColor: '#FFFFFF' }}>
        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        <Text style={{ color: colors.text, fontWeight: '800' }}>
          {coordinate
            ? `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`
            : 'Tap the map to drop a pin'}
        </Text>
        <Text style={{ color: colors.muted }}>
          Confirmed users will get the exact address and a button that opens this pin in Maps.
        </Text>
        <GradientButton label="Use This Pin" onPress={confirm} fullWidth disabled={!coordinate} />
      </View>
    </View>
  );
}
