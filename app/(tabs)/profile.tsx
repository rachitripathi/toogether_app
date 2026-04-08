import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AvatarBubble } from '@/components/AvatarBubble';
import { EventCard } from '@/components/EventCard';
import { HeaderHero } from '@/components/HeaderHero';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';

type Section = 'hosting' | 'joined' | 'past' | null;

export default function ProfileScreen() {
  const { currentUser, events, logout, getUserAverageRating, getInteractedUsers } = useApp();
  const [section, setSection] = useState<Section>(null);

  if (!currentUser) {
    return null;
  }

  const now = new Date();
  const hosting = events.filter((event) => event.creatorId === currentUser.id && new Date(event.dateTime) >= now);
  const past = events.filter((event) => event.creatorId === currentUser.id && new Date(event.dateTime) < now);
  const joined = events.filter(
    (event) => event.approvedUserIds.includes(currentUser.id) && event.creatorId !== currentUser.id
  );
  const rating = getUserAverageRating(currentUser.id);
  const crew = getInteractedUsers().length;

  const renderSection = (label: string, key: Section, items: typeof hosting, emoji: string) => (
    <View style={{ gap: 10 }}>
      <Pressable
        onPress={() => setSection(section === key ? null : key)}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
          <View>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{label}</Text>
            <Text style={{ color: colors.muted }}>{items.length} events</Text>
          </View>
        </View>
        <Ionicons name={section === key ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {section === key ? (
        items.length ? (
          items.map((event) => <EventCard key={event.id} event={event} />)
        ) : (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18 }}>
            <Text style={{ color: colors.muted }}>Nothing here yet.</Text>
          </View>
        )
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <HeaderHero
        title="Profile"
        subtitle={`@${currentUser.username}`}
        right={<AvatarBubble user={currentUser} size={54} />}
      >
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          {[
            { label: 'Plans', value: hosting.length + joined.length + past.length },
            { label: 'Crew', value: crew },
            { label: 'Rating', value: rating ? `${rating.toFixed(1)}★` : 'New' },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 18, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 18 }}>{item.value}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </HeaderHero>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 110 }}>
        {renderSection("Plans I'm Hosting", 'hosting', hosting, '🎯')}
        {renderSection('Plans I Joined', 'joined', joined, '🤝')}
        {renderSection('Past Plans', 'past', past, '🗓️')}

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {[
            { label: 'My Crew', icon: 'people-outline', onPress: () => router.push('/(tabs)/people') },
            { label: 'Notifications', icon: 'notifications-outline' },
            { label: 'About Toogether', icon: 'information-circle-outline' },
          ].map((item, index) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                borderBottomWidth: index === 2 ? 0 : 1,
                borderBottomColor: colors.border,
              }}
            >
              <Ionicons name={item.icon as any} size={18} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.text, fontWeight: '700' }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => {
            logout();
            router.replace('/auth');
          }}
          style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#FFE4E6', padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: '800' }}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
