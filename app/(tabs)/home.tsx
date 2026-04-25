import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { EventCard } from '@/components/EventCard';
import { HeaderHero } from '@/components/HeaderHero';
import { colors, shadow } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import type { EventCategory } from '@/lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const categories: { id: EventCategory | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'food', label: 'Food', emoji: '🍜' },
  { id: 'travel', label: 'Drives', emoji: '🚗' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'other', label: 'Other', emoji: '🎸' },
];

function SearchBar({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: colors.page,
        paddingHorizontal: 20,
        paddingTop: Math.max(insets.top - 26, 6),
        paddingBottom: 10,
      }}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          gap: 10,
          ...shadow.card,
        }}
      >
        <Ionicons name="search" size={18} color="#98A2B3" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search hangouts or areas"
          placeholderTextColor="#98A2B3"
          style={{ flex: 1, minHeight: 52, color: colors.text }}
        />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { currentUser, events } = useApp();
  const [activeCategory, setActiveCategory] = useState<EventCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = events.filter((event) => {
    const matchesCategory = activeCategory === 'all' || event.category === activeCategory;
    const matchesSearch =
      !query ||
      event.title.toLowerCase().includes(query.toLowerCase()) ||
      event.location.toLowerCase().includes(query.toLowerCase());
    const matchesVisibility =
      !event.womenOnly || currentUser?.gender === 'woman' || event.creatorId === currentUser?.id;
    return matchesCategory && matchesSearch && matchesVisibility;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        <HeaderHero
          eyebrow="Hello 👋"
          title={currentUser?.name ?? 'Welcome'}
          onTitlePress={() => router.push('/(tabs)/profile')}
          leading={
            currentUser ? (
              <Pressable onPress={() => router.push('/(tabs)/profile')}>
                <AvatarBubble user={currentUser} size={46} />
              </Pressable>
            ) : null
          }
          right={
            <Pressable
              onPress={() => router.push('/verification')}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#EDF2F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={currentUser?.verified ? 'checkmark-circle' : 'shield-checkmark'}
                size={22}
                color={currentUser?.verified ? '#16A34A' : colors.primary}
              />
            </Pressable>
          }
        />

        <SearchBar query={query} setQuery={setQuery} />

        <View style={{ paddingHorizontal: 20, gap: 18, paddingTop: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {categories.map((category) => {
              const active = category.id === activeCategory;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setActiveCategory(category.id)}
                  style={{
                    backgroundColor: active ? colors.primary : '#FFFFFF',
                    borderRadius: 999,
                    paddingLeft: 8,
                    paddingRight: 16,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : '#E8EDF2',
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{category.emoji}</Text>
                  </View>
                  <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: '800' }}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ gap: 5 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>
              {filtered.length} {filtered.length === 1 ? 'plan' : 'plans'} happening
            </Text>
            <Text style={{ color: colors.muted }}>
              {activeCategory === 'all'
                ? 'Best nearby options right now.'
                : `Showing ${categories.find((item) => item.id === activeCategory)?.label?.toLowerCase()} plans.`}
            </Text>
          </View>

          <View style={{ gap: 14 }}>
            {filtered.length ? (
              filtered.map((event) => <EventCard key={event.id} event={event} />)
            ) : (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 28,
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 48 }}>🌙</Text>
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

      <Pressable
        onPress={() => router.push('/create-event')}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 74,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.lift,
        }}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
