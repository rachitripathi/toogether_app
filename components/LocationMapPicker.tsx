import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

type LocationMapPickerProps = {
  visible: boolean;
  topInset: number;
  coordinate: MapCoordinate | null;
  mapRegion?: MapRegion;
  exactLocation: string;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onApplyCoordinate?: (coordinate: MapCoordinate) => void;
  onRegionChangeComplete?: (region: MapRegion) => void;
};

export function LocationMapPicker({
  visible,
  topInset,
  coordinate,
  exactLocation,
  onClose,
  onUseCurrentLocation,
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

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
          <Ionicons name="map-outline" size={42} color={colors.skyDark} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>
            Map pinning opens on phone preview
          </Text>
          <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 22 }}>
            Web preview cannot load the native map module, but current location still fills the pin coordinates.
          </Text>
          {coordinate ? (
            <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'center' }}>
              {exactLocation || `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`}
            </Text>
          ) : null}
        </View>

        <View style={{ padding: 16, backgroundColor: '#FFFFFF' }}>
          <GradientButton label="Done" onPress={onClose} fullWidth />
        </View>
      </View>
    </Modal>
  );
}
