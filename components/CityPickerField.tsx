import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { CITIES } from '@/lib/cities';

// City as a picked value rather than free text: a searchable list plus "Use my current
// location" (reverse-geocoded, same expo-location calls as Home's location switcher). If a
// town isn't in the list, the search text itself can be used as a last resort.
export function CityPickerField({
  label = 'City',
  value,
  onChange,
  error,
}: {
  label?: string;
  value: string;
  onChange: (city: string) => void;
  error?: string;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const trimmedQuery = query.replace(/\s+/g, ' ').trim();
  const matches = trimmedQuery
    ? CITIES.filter((city) => city.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : CITIES;
  const exactMatch = CITIES.some((city) => city.toLowerCase() === trimmedQuery.toLowerCase());

  const close = () => {
    setOpen(false);
    setQuery('');
    setLocationError(null);
  };

  const pick = (city: string) => {
    onChange(city);
    close();
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is needed. You can pick your city from the list instead.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      const detected = place?.city || place?.subregion || place?.district || place?.region;
      if (!detected) {
        setLocationError("Couldn't work out your city. Pick it from the list instead.");
        return;
      }
      // Prefer the list's spelling when the geocoder's name matches one of ours.
      pick(CITIES.find((city) => city.toLowerCase() === detected.toLowerCase()) ?? detected);
    } catch {
      setLocationError("Couldn't get your location. Pick your city from the list instead.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          minHeight: 54,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: 15 }}>{value || 'Select your city'}</Text>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, paddingTop: insets.top + 40 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 20,
              paddingHorizontal: 20,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Choose your city</Text>
              <Pressable onPress={close} hitSlop={10}>
                <Icon name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <Pressable
              onPress={useCurrentLocation}
              disabled={locating}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: colors.status.info.bg,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 13,
              }}
            >
              {locating ? <ActivityIndicator color={colors.primary} /> : <Icon name="navigate" size={18} color={colors.primary} />}
              <Text style={{ color: colors.primary, fontWeight: '800' }}>
                {locating ? 'Finding your city…' : 'Use my current location'}
              </Text>
            </Pressable>
            {locationError ? <Text style={{ color: colors.danger, fontSize: 12.5 }}>{locationError}</Text> : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: 14,
              }}
            >
              <Icon name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search cities"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                maxLength={40}
                style={{ flex: 1, minHeight: 48, color: colors.text, fontSize: 15 }}
              />
            </View>

            <FlatList
              data={matches}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
              ListHeaderComponent={
                trimmedQuery.length >= 2 && !exactMatch ? (
                  <Pressable
                    onPress={() => pick(trimmedQuery)}
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text style={{ color: colors.text, fontSize: 15 }}>
                      Use <Text style={{ fontWeight: '800' }}>“{trimmedQuery}”</Text>
                    </Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Pressable
                    onPress={() => pick(item)}
                    style={{
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: selected ? colors.primary : colors.text, fontSize: 15, fontWeight: selected ? '800' : '500' }}>
                      {item}
                    </Text>
                    {selected ? <Icon name="checkmark-circle" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
