import { useRef, useState } from 'react';
import { Alert, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { KarmaBadge } from '@/components/KarmaBadge';
import { CtaFill } from '@/components/CtaFill';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CrewRecommendation, User } from '@/lib/types';

type Tab = 'crew' | 'recommended';

const matches = (user: User, query: string) => {
  const q = query.trim().toLowerCase();
  return user.name.toLowerCase().includes(q) || user.username.toLowerCase().includes(q);
};

// Why someone is suggested, from get_crew_recommendations() (migration 019).
const recommendationReason = (rec: CrewRecommendation) => {
  const parts: string[] = [];
  if (rec.sharedPlans) parts.push(`${rec.sharedPlans} ${rec.sharedPlans === 1 ? 'plan' : 'plans'} together`);
  if (rec.mutualCrew) parts.push(`${rec.mutualCrew} mutual crew`);
  if (rec.sameCity && !parts.length) parts.push('In your city');
  return parts.join(' · ');
};

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (text: string) => void; placeholder: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        gap: 8,
      }}
    >
      <Icon name="search" size={16} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ flex: 1, minHeight: 44, color: colors.text, fontSize: 14, fontWeight: '600' }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')}>
          <Icon name="close-circle" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 28, alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 48 }}>{emoji}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>{body}</Text>
    </View>
  );
}

// A person row for the Recommended tab (suggestions and search results): tap to open their
// profile, with the crew action on the right.
function PersonRow({ user, reason }: { user: User; reason?: string }) {
  const { colors } = useTheme();
  const { getCrewStatus, getUserKarma, sendCrewRequest, crewRequests, currentUser, acceptCrewRequest } = useApp();
  const [busy, setBusy] = useState(false);
  const status = getCrewStatus(user.id);
  const karma = getUserKarma(user.id)?.karma ?? null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const incoming = crewRequests.find(
    (request) => request.fromUserId === user.id && request.toUserId === currentUser?.id && request.status === 'pending'
  );
  const action =
    status === 'none'
      ? { label: 'Add', filled: true, onPress: () => run(() => sendCrewRequest(user.id)) }
      : status === 'pending_incoming' && incoming
        ? { label: 'Accept', filled: true, onPress: () => run(() => acceptCrewRequest(incoming.id)) }
        : status === 'pending_outgoing'
          ? { label: 'Requested', filled: false }
          : { label: 'In crew', filled: false };

  return (
    <Pressable
      onPress={() => router.push(`/user/${user.id}`)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <AvatarBubble user={user} size={46} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', flexShrink: 1 }}>{user.name}</Text>
          {user.verified ? <VerifiedBadge size={14} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <KarmaBadge karma={karma} />
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>
            {reason || `@${user.username}`}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={action.onPress}
        disabled={!action.onPress || busy}
        style={{
          minWidth: 84,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          alignItems: 'center',
          backgroundColor: action.filled ? colors.primary : colors.inset,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {action.filled ? <CtaFill radius={999} /> : null}
        <Text style={{ color: action.filled ? '#FFFFFF' : colors.muted, fontWeight: '800', fontSize: 13 }}>{action.label}</Text>
      </Pressable>
    </Pressable>
  );
}

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const {
    currentUser,
    users,
    crewRequests,
    crewRecommendations,
    isLoadingRecommendations,
    refreshCrewRecommendations,
    getCrewMembers,
    getEventsImPartOf,
    getUserKarma,
    getUserById,
    acceptCrewRequest,
    rejectCrewRequest,
    removeFromCrew,
  } = useApp();
  const [tab, setTab] = useState<Tab>('crew');
  const [crewQuery, setCrewQuery] = useState('');
  const [peopleQuery, setPeopleQuery] = useState('');
  const hasLoadedRecommendations = useRef(false);

  // Recommendations are fetched the first time the tab is opened, then on pull-to-refresh.
  const openTab = (next: Tab) => {
    setTab(next);
    if (next === 'recommended' && !hasLoadedRecommendations.current) {
      hasLoadedRecommendations.current = true;
      refreshCrewRecommendations();
    }
  };

  const respond = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  };
  const confirmRemove = (person: User) =>
    Alert.alert(
      `Remove ${person.name.split(' ')[0]} from your crew?`,
      "They won't be told. Invites they haven't answered are withdrawn; plans they've joined aren't affected.",
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => respond(() => removeFromCrew(person.id)) },
      ]
    );

  const allCrew = getCrewMembers();
  const crew = crewQuery ? allCrew.filter((user) => matches(user, crewQuery)) : allCrew;
  const myEvents = getEventsImPartOf();
  const sharedEventsWith = (userId: string) =>
    myEvents.filter((event) => event.creatorId === userId || event.approvedUserIds.includes(userId));
  const incomingRequests = crewRequests.filter(
    (request) => request.toUserId === currentUser?.id && request.status === 'pending'
  );

  // Search on the Recommended tab covers everyone, not just suggestions, so any profile can be
  // reached and added from here.
  const searchResults = peopleQuery.trim()
    ? users.filter((user) => user.id !== currentUser?.id && matches(user, peopleQuery)).slice(0, 30)
    : [];
  const recommended = crewRecommendations
    .map((rec) => ({ rec, user: getUserById(rec.userId) }))
    .filter((item): item is { rec: CrewRecommendation; user: User } => Boolean(item.user));

  const subtitleOpacity = scrollY.interpolate({
    inputRange: [0, 55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerPaddingBottom = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [22, 10],
    extrapolate: 'clamp',
  });

  const tabButton = (key: Tab, label: string, badge?: number) => {
    const active = tab === key;
    return (
      <Pressable
        key={key}
        onPress={() => openTab(key)}
        style={{
          flex: 1,
          minHeight: 40,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          backgroundColor: active ? colors.card : 'transparent',
          ...(active ? shadow.compact : {}),
        }}
      >
        <Text style={{ color: active ? colors.text : colors.muted, fontWeight: '800', fontSize: 14 }}>{label}</Text>
        {badge ? (
          <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <Animated.View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: headerPaddingBottom, gap: 3 }}>
        <CtaFill variant="header" />
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>Crew</Text>
        <Animated.Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, opacity: subtitleOpacity }}>
          {allCrew.length} {allCrew.length === 1 ? 'person' : 'people'} in your crew
        </Animated.Text>
      </Animated.View>

      <View style={{ backgroundColor: colors.page, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: 'row', backgroundColor: colors.inset, borderRadius: 999, padding: 4 }}>
          {tabButton('crew', 'My crew', incomingRequests.length)}
          {tabButton('recommended', 'Recommended')}
        </View>
        {tab === 'crew' && allCrew.length > 0 ? (
          <SearchField value={crewQuery} onChange={setCrewQuery} placeholder="Search your crew" />
        ) : null}
        {tab === 'recommended' ? (
          <SearchField value={peopleQuery} onChange={setPeopleQuery} placeholder="Find anyone by name or username" />
        ) : null}
      </View>

      {tab === 'crew' ? (
        <ScrollView
          key="crew"
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14, paddingBottom: 110 }}
        >
          {incomingRequests.length ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Crew Requests</Text>
              {incomingRequests.map((request) => {
                const user = getUserById(request.fromUserId);
                if (!user) {
                  return null;
                }
                const sharedCount = sharedEventsWith(user.id).length;

                return (
                  <View
                    key={request.id}
                    style={{ backgroundColor: colors.attention, borderRadius: 22, padding: 14, gap: 12 }}
                  >
                    <Pressable onPress={() => router.push(`/user/${user.id}`)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <AvatarBubble user={user} size={48} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={{ color: colors.text, fontWeight: '800' }}>{user.name}</Text>
                          {user.verified ? <VerifiedBadge size={14} /> : null}
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 13 }}>wants to join your crew</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <KarmaBadge karma={getUserKarma(user.id)?.karma ?? null} />
                          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
                            {sharedCount} mutual {sharedCount === 1 ? 'plan' : 'plans'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable
                        onPress={() => respond(() => rejectCrewRequest(request.id))}
                        style={{ flex: 1, minHeight: 42, borderRadius: 16, backgroundColor: colors.solid.decline, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Decline</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => respond(() => acceptCrewRequest(request.id))}
                        style={{ flex: 1, minHeight: 42, borderRadius: 16, backgroundColor: colors.solid.accept, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Accept</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {crew.length ? (
            crew.map((person) => {
              const sharedEvents = sharedEventsWith(person.id);

              return (
                <View
                  key={person.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 22,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <Pressable onPress={() => router.push(`/user/${person.id}`)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <AvatarBubble user={person} size={50} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{person.name}</Text>
                        {person.verified ? <VerifiedBadge size={14} /> : null}
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13 }}>@{person.username}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <KarmaBadge karma={getUserKarma(person.id)?.karma ?? null} />
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
                          {sharedEvents.length} mutual {sharedEvents.length === 1 ? 'plan' : 'plans'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.inset, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="chevron-forward" size={16} color={colors.muted} />
                    </View>
                  </Pressable>

                  {sharedEvents.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {sharedEvents.map((event) => (
                        <Pressable
                          key={event.id}
                          onPress={() => router.push(`/event/${event.id}`)}
                          style={{ backgroundColor: colors.inset, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                          <Text>{event.emoji}</Text>
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{event.title}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 10,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13, flex: 1 }}>{person.city || 'Guwahati'}</Text>
                    <Pressable onPress={() => confirmRemove(person)} hitSlop={6} style={{ paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ color: colors.status.danger.text, fontWeight: '800', fontSize: 12 }}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : crewQuery ? (
            <EmptyState emoji="🔍" title="No match" body={`No one in your crew matches "${crewQuery}".`} />
          ) : (
            <View style={{ gap: 12 }}>
              <EmptyState
                emoji="🌱"
                title="No crew yet"
                body="Join or host plans to meet people, or find someone you know and add them."
              />
              <Pressable
                onPress={() => openTab('recommended')}
                style={{ alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }}
              >
                <CtaFill radius={999} />
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>See recommendations</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          key="recommended"
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isLoadingRecommendations && !peopleQuery}
              onRefresh={refreshCrewRecommendations}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10, paddingBottom: 110 }}
        >
          {peopleQuery.trim() ? (
            searchResults.length ? (
              searchResults.map((user) => <PersonRow key={user.id} user={user} />)
            ) : (
              <EmptyState emoji="🔍" title="No one found" body={`No one matches "${peopleQuery.trim()}".`} />
            )
          ) : recommended.length ? (
            <>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 }}>
                People you've made plans with come first.
              </Text>
              {recommended.map(({ rec, user }) => (
                <PersonRow key={user.id} user={user} reason={recommendationReason(rec)} />
              ))}
            </>
          ) : isLoadingRecommendations ? null : (
            <EmptyState
              emoji="✨"
              title="No suggestions yet"
              body="Join a few plans and people you meet will show up here. You can also search for anyone above."
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}
