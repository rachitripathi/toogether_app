import { useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvatarBubble } from '@/components/AvatarBubble';
import { EventCard } from '@/components/EventCard';
import { HeaderHero } from '@/components/HeaderHero';
import { LocationMapPicker, type MapCoordinate, type MapRegion } from '@/components/LocationMapPicker';
import { PinMark } from '@/components/PinMark';
import { EventCardSkeleton } from '@/components/SkeletonLoaders/EventCardSkeleton';
import { colors } from '@/lib/theme';
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
          borderColor: 'rgba(15, 18, 34, 0.08)',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          gap: 10,
          shadowColor: colors.primary,
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 5,
        }}
      >
        <Ionicons name="search" size={18} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search hangouts or areas"
          placeholderTextColor="#A6A2A8"
          style={{ flex: 1, minHeight: 50, color: colors.text, fontSize: 14, fontWeight: '600' }}
        />
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.page, 'rgba(255,255,255,0)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -8,
          height: 8,
        }}
      />
    </View>
  );
}

export default function HomeScreen() {
  const { currentUser, events, isLoadingEvents, refreshFeed, getUsageSummary } = useApp();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<EventCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [locationLabel, setLocationLabel] = useState('Guwahati');
  const [locationCoordinate, setLocationCoordinate] = useState<MapCoordinate | null>(null);
  const [locationMapRegion, setLocationMapRegion] = useState<MapRegion>(defaultMapRegion);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

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
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { label: string; coordinate: MapCoordinate | null };
        if (parsed.label) setLocationLabel(parsed.label);
        if (parsed.coordinate) {
          setLocationCoordinate(parsed.coordinate);
          setLocationMapRegion((prev) => ({ ...prev, ...parsed.coordinate }));
        }
      } catch {
        // ignore malformed cache
      }
    });
  }, []);

  const persistLocation = (label: string, coordinate: MapCoordinate | null) => {
    AsyncStorage.setItem(HOME_LOCATION_KEY, JSON.stringify({ label, coordinate }));
  };

  const applyCoordinate = async (coordinate: MapCoordinate) => {
    setLocationCoordinate(coordinate);
    setLocationMapRegion((prev) => ({ ...prev, ...coordinate }));

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

  const useCurrentLocation = async () => {
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
                <Ionicons name="location-sharp" size={13} color={colors.primary} />
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 12, flexShrink: 1 }}>
                  {locationLabel}
                </Text>
                <Ionicons name="chevron-down" size={13} color={colors.muted} />
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
                      backgroundColor: '#DFF4E8',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                    <Text style={{ color: '#15803D', fontWeight: '800', fontSize: 12 }}>Verified</Text>
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
                      backgroundColor: '#FFF0D6',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                    }}
                  >
                    <Ionicons name="hourglass-outline" size={14} color="#B45309" />
                    <Text style={{ color: '#B45309', fontWeight: '800', fontSize: 12 }}>In review</Text>
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
                    backgroundColor: '#111111',
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}
                >
                  <Ionicons name="shield-checkmark-outline" size={14} color="#FFD700" />
                  <Text style={{ color: '#FFD700', fontWeight: '800', fontSize: 12 }}>Verify</Text>
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
                    borderColor: active ? '#4A68E0' : 'rgba(20, 24, 50, 0.1)',
                    paddingLeft: 14,
                    paddingRight: 16,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    shadowColor: '#3A4B8C',
                    shadowOpacity: active ? 0.25 : 0.12,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 3,
                  }}
                >
                  {category.id === 'all' ? (
                    <Ionicons name="grid" size={16} color={active ? '#FFFFFF' : colors.primary} />
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
                backgroundColor: usage.joinLimitReached ? '#FFF7E8' : colors.surface,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: usage.joinLimitReached ? '#FDE7B3' : colors.border,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Ionicons name="flash-outline" size={18} color={usage.joinLimitReached ? '#B45309' : colors.primary} />
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
              backgroundColor: '#FFFFFF',
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
              onPress={useCurrentLocation}
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
              <Ionicons name="navigate" size={18} color={colors.primary} />
              <Text style={{ fontWeight: '800', color: colors.text }}>
                {locationLoading ? 'Fetching current location…' : 'Use current location'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowLocationOptions(false);
                setShowLocationMap(true);
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
              <Ionicons name="map" size={18} color={colors.primary} />
              <Text style={{ fontWeight: '800', color: colors.text }}>Choose on map</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <LocationMapPicker
        visible={showLocationMap}
        topInset={insets.top}
        coordinate={locationCoordinate}
        mapRegion={locationMapRegion}
        exactLocation={locationLabel}
        onClose={() => setShowLocationMap(false)}
        onUseCurrentLocation={useCurrentLocation}
        onApplyCoordinate={applyCoordinate}
        onRegionChangeComplete={setLocationMapRegion}
      />
    </View>
  );
}
