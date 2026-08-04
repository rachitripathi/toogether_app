import { useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { GradientButton } from '@/components/GradientButton';
import { colors, gradients } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { User } from '@/lib/types';

function RateModal({ user, visible, onClose }: { user: User | null; visible: boolean; onClose: () => void }) {
  const { getEventsImPartOf, rateUser, getMyRatingForUser } = useApp();
  const [stars, setStars] = useState(0);

  if (!visible || !user) {
    return null;
  }

  const sharedEvent = getEventsImPartOf().find(
    (event) => event.creatorId === user.id || event.approvedUserIds.includes(user.id)
  );
  const existing = sharedEvent ? getMyRatingForUser(user.id, sharedEvent.id) : null;
  const currentValue = stars || existing || 0;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Rate {user.name.split(' ')[0]}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <AvatarBubble user={user} size={72} />
            <Text style={{ color: colors.muted }}>How was your vibe check?</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setStars(star)}>
                  <Ionicons
                    name={star <= currentValue ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= currentValue ? '#F59E0B' : '#D0D5DD'}
                  />
                </Pressable>
              ))}
            </View>
          </View>
          <GradientButton
            label="Submit Rating"
            onPress={() => {
              if (sharedEvent && currentValue) {
                rateUser(user.id, sharedEvent.id, currentValue);
              }
              onClose();
            }}
            fullWidth
            disabled={!currentValue}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const {
    currentUser,
    crewRequests,
    getCrewMembers,
    getInteractedUsers,
    getEventsImPartOf,
    getUserAverageRating,
    getMyRatingForUser,
    getUserById,
    acceptCrewRequest,
    rejectCrewRequest,
  } = useApp();
  const [ratingTarget, setRatingTarget] = useState<User | null>(null);
  const [query, setQuery] = useState('');
  const crewMap = new Map<string, User>();
  [...getCrewMembers(), ...getInteractedUsers()].forEach((user) => crewMap.set(user.id, user));
  const allCrew = [...crewMap.values()];
  const crew = query
    ? allCrew.filter(
        (user) =>
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.username.toLowerCase().includes(query.toLowerCase())
      )
    : allCrew;
  const myEvents = getEventsImPartOf();
  const incomingRequests = crewRequests.filter(
    (request) => request.toUserId === currentUser?.id && request.status === 'pending'
  );

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <LinearGradient colors={[...gradients.crew]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Animated.View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: headerPaddingBottom, gap: 3 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>My Crew</Text>
          <Animated.Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, opacity: subtitleOpacity }}>
            {allCrew.length} {allCrew.length === 1 ? 'person' : 'people'} you've connected with
          </Animated.Text>
        </Animated.View>
      </LinearGradient>

      {allCrew.length > 0 ? (
        <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              gap: 8,
            }}
          >
            <Ionicons name="search" size={16} color="#9C9AA4" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or username"
              placeholderTextColor="#A6A2A8"
              style={{ flex: 1, minHeight: 44, color: colors.text, fontSize: 14, fontWeight: '600' }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}
      >
        {incomingRequests.length ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Crew Requests</Text>
            {incomingRequests.map((request) => {
              const user = getUserById(request.fromUserId);
              if (!user) {
                return null;
              }

              const sharedCount = myEvents.filter(
                (event) => event.creatorId === user.id || event.approvedUserIds.includes(user.id)
              ).length;
              const average = getUserAverageRating(user.id);
              const myRating = getMyRatingForUser(user.id);

              return (
                <View
                  key={request.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <AvatarBubble user={user} size={48} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: colors.text, fontWeight: '800' }}>{user.name}</Text>
                        {user.verified ? <Ionicons name="checkmark-circle" size={14} color="#15803D" /> : null}
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13 }}>wants to join your crew</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
                          {average ? `${average.toFixed(1)} karma` : 'New connection'} · {sharedCount} mutual{' '}
                          {sharedCount === 1 ? 'plan' : 'plans'}
                          {myRating ? ` · ${myRating}★ from you` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => rejectCrewRequest(request.id)}
                      style={{ flex: 1, minHeight: 42, borderRadius: 16, backgroundColor: '#FFE4E6', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: colors.danger, fontWeight: '800' }}>Decline</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => acceptCrewRequest(request.id)}
                      style={{ flex: 1, minHeight: 42, borderRadius: 16, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#15803D', fontWeight: '800' }}>Accept</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {crew.length ? (
          crew.map((person) => {
            const sharedEvents = myEvents.filter(
              (event) => event.creatorId === person.id || event.approvedUserIds.includes(person.id)
            );
            const average = getUserAverageRating(person.id);
            const myRating = getMyRatingForUser(person.id);

            return (
              <View
                key={person.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 14,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <Pressable onPress={() => router.push(`/user/${person.id}`)}>
                    <AvatarBubble user={person} size={50} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{person.name}</Text>
                      {person.verified ? <Ionicons name="checkmark-circle" size={14} color="#15803D" /> : null}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>@{person.username}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
                        {average ? `${average.toFixed(1)} karma` : 'New connection'} · {sharedEvents.length} mutual{' '}
                        {sharedEvents.length === 1 ? 'plan' : 'plans'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => router.push(`/user/${person.id}`)}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                </View>

                {sharedEvents.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {sharedEvents.map((event) => (
                      <Pressable
                        key={event.id}
                        onPress={() => router.push(`/event/${event.id}`)}
                        style={{ backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}
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
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(20, 24, 46, 0.06)',
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>{person.city || 'Guwahati'}</Text>
                  <Pressable
                    onPress={() => setRatingTarget(person)}
                    style={{ backgroundColor: myRating ? '#FEF3C7' : '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}
                  >
                    <Text style={{ color: myRating ? '#B45309' : colors.text, fontWeight: '800', fontSize: 12 }}>
                      {myRating ? `${myRating}★ Rated` : 'Rate'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : query ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 48 }}>🔍</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>No match</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>
              No one in your crew matches "{query}".
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 48 }}>🌱</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>No crew yet</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>
              Join or create events to start meeting people.
            </Text>
          </View>
        )}
      </ScrollView>

      <RateModal user={ratingTarget} visible={Boolean(ratingTarget)} onClose={() => setRatingTarget(null)} />
    </View>
  );
}
