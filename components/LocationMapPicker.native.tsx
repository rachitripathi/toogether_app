import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent } from 'react-native-maps';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';
import type { MapCoordinate, MapRegion } from '@/components/LocationMapPicker';

type LocationMapPickerProps = {
  visible: boolean;
  topInset: number;
  coordinate: MapCoordinate | null;
  mapRegion: MapRegion;
  exactLocation: string;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onApplyCoordinate: (coordinate: MapCoordinate) => void;
  onRegionChangeComplete: (region: MapRegion) => void;
};

export function LocationMapPicker({
  visible,
  topInset,
  coordinate,
  mapRegion,
  exactLocation,
  onClose,
  onUseCurrentLocation,
  onApplyCoordinate,
  onRegionChangeComplete,
}: LocationMapPickerProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <View
          style={{
            paddingTop: topInset + 14,
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
            onPress={onClose}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', flex: 1 }}>Pin exact location</Text>
          <Pressable onPress={onUseCurrentLocation} style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
            <Text style={{ color: colors.skyDark, fontWeight: '800' }}>Use mine</Text>
          </Pressable>
        </View>

        <MapView
          style={{ flex: 1 }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={mapRegion}
          region={mapRegion}
          onRegionChangeComplete={onRegionChangeComplete}
          onPress={(event: MapPressEvent) => onApplyCoordinate(event.nativeEvent.coordinate)}
        >
          {coordinate ? <Marker coordinate={coordinate} /> : null}
        </MapView>

        <View style={{ padding: 16, gap: 10, backgroundColor: '#FFFFFF' }}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>
            {exactLocation || 'Tap the map to drop a pin'}
          </Text>
          <Text style={{ color: colors.muted }}>
            Confirmed users will get the exact address and a button that opens this pin in Maps.
          </Text>
          <GradientButton label="Use This Pin" onPress={onClose} fullWidth disabled={!coordinate} />
        </View>
      </View>
    </Modal>
  );
}
