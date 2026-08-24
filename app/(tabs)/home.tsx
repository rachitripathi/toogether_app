import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvatarBubble } from '@/components/AvatarBubble';
import { EventCard } from '@/components/EventCard';
import { HeaderHero } from '@/components/HeaderHero';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useLocationPickerStore, type MapCoordinate, type MapRegion } from '@/store/locationPickerStore';
import { PinMark } from '@/components/PinMark';
import { EventCardSkeleton } from '@/components/SkeletonLoaders/EventCardSkeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import type { EventCategory } from '@/lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HOME_LOCATION_KEY = 'home_location';

const defaultMapRegion: MapRegion = {
  latitude: 26.1445,
  longitude: 91.7362,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const categories: { id: EventCategory | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '🗓️' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'chill', label: 'Chill', emoji: '☕' },
  { id: 'music', label: 'Music', emoji: '🎸' },
  { id: 'sports', label: 'Sports', emoji: '🏸' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'travel', label: 'Drives', emoji: '🚗' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'other', label: 'Other', emoji: '🎲' },
];

function SearchBar({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.page,
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 14,
      }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          gap: 10,
        }}
      >
        <Icon name="search" size={18} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search hangouts or areas"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, minHeight: 50, color: colors.text, fontSize: 14, fontWeight: '600' }}
        />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { currentUser, events, isLoadingEvents, refreshFeed, getUsageSummary } = useApp();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<EventCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationCoordinate, setLocationCoordinate] = useState<MapCoordinate | null>(null);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const openLocationPicker = useLocationPickerStore((state) => state.open);
  const consumeLocationResult = useLocationPickerStore((state) => state.consumeResult);

  const onRefresh = () => {
    setRefreshing(true);
    refreshFeed();
  };

  useEffect(() => {
    if (!isLoadingEvents) {
      setRefreshing(false);
    }
  }, [isLoadingEvents]);

  useEffect(() => {
    AsyncStorage.getItem(HOME_LOCATION_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { label: string; coordinate: MapCoordinate | null };
          if (parsed.label) setLocationLabel(parsed.label);
          if (parsed.coordinate) {
            setLocationCoordinate(parsed.coordinate);
          }
          return;
        } catch {
          // fall through to a fresh fetch below on malformed cache
        }
      }

      // No location saved yet — try to use their real location right away instead of
      // silently showing a made-up default. requestForegroundPermissionsAsync only
      // actually shows the OS prompt when permission is still undetermined; if the
      // user already granted or denied it, this just resolves with that existing
      // status, so it never re-nags someone who already said no.
      fetchCurrentLocation();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistLocation = (label: string, coordinate: MapCoordinate | null) => {
    AsyncStorage.setItem(HOME_LOCATION_KEY, JSON.stringify({ label, coordinate }));
  };

  const applyCoordinate = async (coordinate: MapCoordinate) => {
    setLocationCoordinate(coordinate);

    try {
      const [place] = await Location.reverseGeocodeAsync(coordinate);
      const label = place?.district || place?.subregion || place?.city || place?.region || 'Selected location';
      setLocationLabel(label);
      persistLocation(label, coordinate);
    } catch {
      const fallback = `${coordinate.latitude.toFixed(3)}, ${coordinate.longitude.toFixed(3)}`;
      setLocationLabel(fallback);
      persistLocation(fallback, coordinate);
    }
  };

  const fetchCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is needed to use your current location.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      await applyCoordinate({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      setShowLocationOptions(false);
    } catch {
      setLocationError("Couldn't fetch your location. Try again.");
    } finally {
      setLocationLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const coordinate = consumeLocationResult('home');
      if (coordinate) {
        applyCoordinate(coordinate);
      }
      // consumeLocationResult/applyCoordinate close over per-render state but only
      // do anything when the picker actually left a result behind, so re-running
      // this on every focus (not just once) is harmless.
    }, [consumeLocationResult])
  );

  const filtered = events.filter((event) => {
    const normalizedQuery = query.toLowerCase();
    const matchesCategory = activeCategory === 'all' || event.category === activeCategory;
    const matchesSearch =
      !query ||
      event.title.toLowerCase().includes(normalizedQuery) ||
      event.area.toLowerCase().includes(normalizedQuery) ||
      event.locationNote?.toLowerCase().includes(normalizedQuery);
    const matchesVisibility =
      !event.womenOnly || currentUser?.gender === 'woman' || event.creatorId === currentUser?.id;
    return matchesCategory && matchesSearch && matchesVisibility;
  });

  const pinnedCount = filtered.filter((event) => event.pinned).length;
  const usage = getUsageSummary();

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {/* Reserves the status-bar strip outside the ScrollView, so the sticky
          search bar (which pins to y=0 of the ScrollView's own frame) never
          has to sit behind it — no scroll-linked padding logic needed. */}
      <View style={{ height: insets.top, backgroundColor: colors.page }} />
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 154 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <HeaderHero
          topInset={0}
          eyebrow={`Hey ${currentUser?.name?.split(' ')[0] ?? 'there'} 👋`}
          title="What's the plan?"
          onTitlePress={() => router.push('/(tabs)/profile')}
          leading={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {currentUser ? (
                <Pressable onPress={() => router.push('/(tabs)/profile')}>
                  <AvatarBubble user={currentUser} size={46} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setShowLocationOptions(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.surface,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  maxWidth: 130,
                }}
              >
                <Icon name="location-sharp" size={13} color={colors.primary} />
                <Text numberOfLines={1} style={{ color: locationLabel ? colors.text : colors.muted, fontWeight: '700', fontSize: 12, flexShrink: 1 }}>
                  {locationLoading ? 'Locating…' : (locationLabel ?? 'Set location')}
                </Text>
                <Icon name="chevron-down" size={13} color={colors.muted} />
              </Pressable>
            </View>
          }
          right={
            (() => {
              const verificationStatus =
                currentUser?.verificationStatus ?? (currentUser?.verified ? 'approved' : 'unverified');

              if (verificationStatus === 'approved') {
                return (
                  <Pressable
                    onPress={() => router.push('/verification')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: colors.status.info.bg,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                    }}
                  >
                    <VerifiedBadge size={14} />
                    <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Verified</Text>
                  </Pressable>
                );
              }

              if (verificationStatus === 'pending') {
                return (
                  <Pressable
                    onPress={() => router.push('/verification')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: colors.status.warning.bg,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                    }}
                  >
                    <Icon name="hourglass-outline" size={14} color={colors.status.warning.text} />
                    <Text style={{ color: colors.status.warning.text, fontWeight: '800', fontSize: 12 }}>In review</Text>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  onPress={() => router.push('/verification')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: colors.primary,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}
                >
                  <VerifiedBadge size={14} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>Verify</Text>
                </Pressable>
              );
            })()
          }
        />

        <SearchBar query={query} setQuery={setQuery} />

        <View style={{ paddingHorizontal: 20, gap: 18, paddingTop: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 10, paddingHorizontal: 2 }}
          >
            {categories.map((category) => {
              const active = category.id === activeCategory;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setActiveCategory(category.id)}
                  style={{
                    backgroundColor: active ? colors.primary : colors.card,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    paddingLeft: 14,
                    paddingRight: 16,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    shadowColor: scheme === 'dark' ? '#000000' : '#3A4B8C',
                    shadowOpacity: active ? 0.25 : 0.12,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 3,
                  }}
                >
                  {category.id === 'all' ? (
                    <Icon name="grid" size={16} color={active ? '#FFFFFF' : colors.primary} />
                  ) : (
                    <Text style={{ fontSize: 15 }}>{category.emoji}</Text>
                  )}
                  <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: '700' }}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ gap: 3 }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Nearby
            </Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
              {filtered.length} {filtered.length === 1 ? 'plan' : 'plans'} happening
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '500', flex: 1 }}>
                {activeCategory === 'all'
                  ? 'Best nearby options right now.'
                  : `Showing ${categories.find((item) => item.id === activeCategory)?.label?.toLowerCase()} plans.`}
              </Text>
              {pinnedCount ? <PinMark size={14} /> : null}
            </View>
          </View>

          {usage.monetisationEnabled ? (
            <View
              style={{
                backgroundColor: usage.joinLimitReached ? colors.status.warning.bg : colors.surface,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: usage.joinLimitReached ? colors.status.warning.border : colors.border,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Icon name="flash-outline" size={18} color={usage.joinLimitReached ? colors.status.warning.text : colors.primary} />
              <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>
                {usage.joinUsed}/{usage.joinLimit} join requests used this month
              </Text>
              <Text style={{ color: colors.muted, fontWeight: '800' }}>{usage.credits} credits</Text>
            </View>
          ) : null}

          <View style={{ gap: 16 }}>
            {isLoadingEvents && !events.length ? (
              <>
                <EventCardSkeleton />
                <EventCardSkeleton />
                <EventCardSkeleton />
              </>
            ) : filtered.length ? (
              filtered.map((event) => <EventCard key={event.id} event={event} />)
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 28,
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>No plans in this filter</Text>
                <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 22 }}>
                  Try another category or clear your search. If nothing fits, create the vibe yourself and let people
                  rally around it.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showLocationOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationOptions(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
          onPress={() => setShowLocationOptions(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
              paddingBottom: Math.max(insets.bottom, 16) + 20,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>Set your location</Text>
            {locationError ? <Text style={{ color: colors.danger, fontSize: 13 }}>{locationError}</Text> : null}
            <Pressable
              onPress={fetchCurrentLocation}
              disabled={locationLoading}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                opacity: locationLoading ? 0.6 : 1,
              }}
            >
              <Icon name="navigate" size={18} color={colors.primary} />
              <Text style={{ fontWeight: '800', color: colors.text }}>
                {locationLoading ? 'Fetching current location…' : 'Use current location'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowLocationOptions(false);
                openLocationPicker('home', {
                  coordinate: locationCoordinate,
                  region: locationCoordinate ? { ...defaultMapRegion, ...locationCoordinate } : defaultMapRegion,
                });
                router.push('/location-picker');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
              }}
            >
              <Icon name="map" size={18} color={colors.primary} />
              <Text style={{ fontWeight: '800', color: colors.text }}>Choose on map</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
