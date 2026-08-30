import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocationPickerStore, type MapCoordinate, type MapRegion } from '@/store/locationPickerStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Google's standard dark map style (docs.mapsplatform.google.com) — without this the
// map renders its default bright-white basemap regardless of app theme, which looks
// broken embedded in an otherwise dark screen.
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1B1F2B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1B1F2B' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A93A8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#B4BCCF' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8A93A8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#152420' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#5C7A6E' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2F3D' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1B1F2B' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8A93A8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#333A4D' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1B1F2B' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#B4BCCF' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2A2F3D' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1420' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5C7A93' }] },
];

export default function LocationPickerScreen() {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const initialCoordinate = useLocationPickerStore((state) => state.initialCoordinate);
  const initialRegion = useLocationPickerStore((state) => state.initialRegion);
  const resolve = useLocationPickerStore((state) => state.resolve);

  const mapRef = useRef<MapView>(null);
  // The pin is fixed at the screen's center (Uber-style) — the coordinate is always
  // just "wherever the map is currently centered," so it tracks `region` directly
  // instead of needing its own state synced via taps.
  const [region, setRegion] = useState<MapRegion>(
    initialCoordinate ? { ...initialRegion, ...initialCoordinate } : initialRegion
  );
  const coordinate: MapCoordinate = { latitude: region.latitude, longitude: region.longitude };
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const pinLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mapReady) return;
    // react-native-maps gives no "tiles failed" callback — a map stuck blank this
    // long almost always means a missing/invalid Google Maps API key (Android) or a
    // dead network, so surface a hint instead of leaving the screen looking frozen.
    const timeout = setTimeout(() => setSlowLoad(true), 6000);
    return () => clearTimeout(timeout);
  }, [mapReady]);

  const liftPin = () => {
    Animated.timing(pinLift, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };
  const dropPin = () => {
    Animated.spring(pinLift, { toValue: 0, useNativeDriver: true, friction: 4 }).start();
  };

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
      // MapView isn't a controlled `region` prop here (so a user's own pan/zoom
      // gestures never fight a re-render) — recentering after "Use mine" has to
      // go through the imperative ref instead of just setting state. The region
      // state (and so `coordinate`) catches up via onRegionChangeComplete once the
      // animation lands.
      mapRef.current?.animateToRegion({ ...region, ...next }, 500);
    } catch {
      setError("Couldn't fetch your location. Try again.");
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
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
          backgroundColor: colors.card,
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
          <Icon name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', flex: 1 }}>Pin exact location</Text>
        <Pressable onPress={useMyLocation} disabled={locating} style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
          <Text style={{ color: colors.skyDark, fontWeight: '800' }}>{locating ? 'Locating…' : 'Use mine'}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={scheme === 'dark' ? DARK_MAP_STYLE : undefined}
          initialRegion={region}
          loadingEnabled
          loadingIndicatorColor={colors.skyDark}
          loadingBackgroundColor={colors.page}
          onMapReady={() => setMapReady(true)}
          onRegionChange={liftPin}
          onRegionChangeComplete={(next: Region) => {
            setRegion(next);
            dropPin();
          }}
        />

        {/* Fixed center pin, Uber-style — the coordinate is wherever this sits, so it
            never moves with the map; the map moves under it instead. */}
        <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36 }} pointerEvents="none">
          <Animated.View
            style={{
              transform: [
                { translateY: pinLift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
              ],
            }}
          >
            <Icon name="location-sharp" size={36} color={colors.skyDark} />
          </Animated.View>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text, alignSelf: 'center', opacity: 0.5 }} />
        </View>

        {!mapReady && slowLoad ? (
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 16,
              right: 16,
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>Map is taking a while to load</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              Check your connection, or this device may be missing a valid Google Maps API key.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: 16, gap: 10, backgroundColor: colors.card }}>
        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        <Text style={{ color: colors.text, fontWeight: '800' }}>
          {coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}
        </Text>
        <Text style={{ color: colors.muted }}>
          Confirmed users will get the exact address and a button that opens this pin in Maps.
        </Text>
        <GradientButton label="Use This Pin" onPress={confirm} fullWidth />
      </View>
    </View>
  );
}
