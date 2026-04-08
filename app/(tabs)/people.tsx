import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { HeaderHero } from '@/components/HeaderHero';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
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
  const crewMap = new Map<string, User>();
  [...getCrewMembers(), ...getInteractedUsers()].forEach((user) => crewMap.set(user.id, user));
  const crew = [...crewMap.values()];
  const myEvents = getEventsImPartOf();
  const incomingRequests = crewRequests.filter(
    (request) => request.toUserId === currentUser?.id && request.status === 'pending'
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <HeaderHero title="My Crew" subtitle={`${crew.length} people you've vibed with`} />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}>
        {incomingRequests.length ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Crew Requests</Text>
            {incomingRequests.map((request) => {
              const user = getUserById(request.fromUserId);
              if (!user) {
                return null;
              }

              return (
                <View
                  key={request.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 16,
                    gap: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <AvatarBubble user={user} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>{user.name}</Text>
                      <Text style={{ color: colors.muted }}>wants to join your crew</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => rejectCrewRequest(request.id)}
                      style={{ flex: 1, minHeight: 46, borderRadius: 18, backgroundColor: '#FFE4E6', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: colors.danger, fontWeight: '800' }}>Decline</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => acceptCrewRequest(request.id)}
                      style={{ flex: 1, minHeight: 46, borderRadius: 18, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}
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
                  backgroundColor: '#FFFFFF',
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  gap: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable onPress={() => router.push(`/user/${person.id}`)}>
                    <AvatarBubble user={person} size={54} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{person.name}</Text>
                    <Text style={{ color: colors.muted }}>@{person.username}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                      {sharedEvents.length} shared {sharedEvents.length === 1 ? 'plan' : 'plans'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push(`/user/${person.id}`)}
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {average ? `${average.toFixed(1)}★ average` : 'New connection'}
                  </Text>
                  <Pressable
                    onPress={() => setRatingTarget(person)}
                    style={{ backgroundColor: myRating ? '#FEF3C7' : colors.page, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                  >
                    <Text style={{ color: myRating ? '#B45309' : colors.muted, fontWeight: '800' }}>
                      {myRating ? `${myRating}★ Rated` : 'Rate'}
                    </Text>
                  </Pressable>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {sharedEvents.map((event) => (
                    <Pressable
                      key={event.id}
                      onPress={() => router.push(`/event/${event.id}`)}
                      style={{ backgroundColor: colors.page, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                      <Text>{event.emoji}</Text>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{event.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            );
          })
        ) : (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center', gap: 8 }}>
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
