import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AvatarBubble } from '@/components/AvatarBubble';
import { EventCard } from '@/components/EventCard';
import { HeaderHero } from '@/components/HeaderHero';
import { colors, shadow } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';

type Section = 'hosting' | 'joined' | 'past' | null;

function TrustChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F8FAFC',
      }}
    >
      <Ionicons name={icon} size={14} color={colors.skyDark} />
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 12,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { currentUser, events, logout, getUserAverageRating, getInteractedUsers } = useApp();
  const [section, setSection] = useState<Section>('hosting');

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
  const totalPlans = hosting.length + joined.length + past.length;

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
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
          <View>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{label}</Text>
            <Text style={{ color: colors.muted }}>{items.length} plans</Text>
          </View>
        </View>
        <Ionicons name={section === key ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {section === key ? (
        items.length ? (
          items.map((event) => <EventCard key={event.id} event={event} />)
        ) : (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 18,
            }}
          >
            <Text style={{ color: colors.muted }}>Nothing here yet.</Text>
          </View>
        )
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <HeaderHero title="Profile" subtitle={`${currentUser.city} • @${currentUser.username}`} />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 110 }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            gap: 16,
            ...shadow.card,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable
              onPress={() => router.push('/verification')}
              style={{ position: 'relative' }}
            >
              <AvatarBubble user={currentUser} size={72} />
              <View
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  borderWidth: 3,
                  borderColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>
                  {currentUser.name}, {currentUser.age}
                </Text>
                {currentUser.verified ? (
                  <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                ) : null}
              </View>
              {currentUser.bio ? <Text style={{ color: colors.muted, lineHeight: 20 }}>{currentUser.bio}</Text> : null}
              <Pressable onPress={() => router.push('/verification')}>
                <Text style={{ color: colors.skyDark, fontWeight: '800' }}>Edit photo and trust details</Text>
              </Pressable>
            </View>
          </View>

          <Text style={{ color: colors.skyDark, fontWeight: '700' }}>
            {totalPlans} plans • {crew} crew connections • {rating ? `${rating.toFixed(1)} karma` : 'New karma'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ProfileMetric label="Plans" value={totalPlans} />
          <ProfileMetric label="Crew" value={crew} />
          <ProfileMetric label="Karma" value={rating ? rating.toFixed(1) : 'New'} />
        </View>

        {!currentUser.verified ? (
          <Pressable
            onPress={() => router.push('/verification')}
            style={{
              backgroundColor: '#EFF6FF',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: '#D5E8FF',
              padding: 18,
              gap: 10,
              ...shadow.card,
            }}
          >
            <Text style={{ color: colors.skyDark, fontSize: 16, fontWeight: '800' }}>Verify to boost trust</Text>
            <Text style={{ color: colors.text, lineHeight: 22 }}>
              Verified profiles feel safer to join, stand out better in discovery, and usually get faster approvals from hosts.
            </Text>
          </Pressable>
        ) : null}

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            gap: 14,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Trust signals</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <TrustChip icon="shield-checkmark-outline" label={currentUser.verified ? 'ID verified' : 'Verification pending'} />
            <TrustChip icon="sparkles-outline" label={past.length ? `${past.length} past hangouts` : 'First hangout soon'} />
            <TrustChip icon="people-outline" label={`${crew} crew connections`} />
            <TrustChip icon="location-outline" label={currentUser.city} />
          </View>
        </View>

        {renderSection("Plans I'm Hosting", 'hosting', hosting, '🎯')}
        {renderSection('Plans I Joined', 'joined', joined, '🤝')}
        {renderSection('Past Plans', 'past', past, '🗓️')}

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          {[
            { label: 'My Crew', icon: 'people-outline', onPress: () => router.push('/(tabs)/people') },
            { label: 'Notifications Inbox', icon: 'notifications-outline', onPress: () => router.push('/(tabs)/activity') },
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
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
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
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: '#FFE4E6',
            padding: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: '800' }}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
