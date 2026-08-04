import { useLocalSearchParams, router } from 'expo-router';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvatarBubble } from '@/components/AvatarBubble';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

function InviteToEventModal({
  visible,
  onClose,
  events,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  events: { id: string; title: string; emoji: string; location: string }[];
  onSelect: (eventId: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Invite to my event</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          {events.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => onSelect(event.id)}
              style={{
                backgroundColor: colors.page,
                borderRadius: 18,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 24 }}>{event.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{event.title}</Text>
                <Text style={{ color: colors.muted }}>{event.location}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function TrustPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'warm' }) {
  const backgroundColor = tone === 'accent' ? '#E0F2FE' : tone === 'warm' ? '#FFF1D6' : '#F8FAFC';
  const color = tone === 'accent' ? colors.skyDark : tone === 'warm' ? '#B45309' : colors.text;

  return (
    <View style={{ backgroundColor, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}>
      <Text style={{ color, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentUser,
    getUserById,
    events,
    getEventsImPartOf,
    getUserAverageRating,
    getCrewStatus,
    sendCrewRequest,
    inviteToEvent,
  } = useApp();
  const user = getUserById(id ?? '');

  if (!currentUser) {
    return null;
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <View
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 20,
            paddingBottom: 24,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
          <Text style={{ fontSize: 40 }}>🤔</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Profile not found</Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            This user may have removed their account or the link is no longer valid.
          </Text>
        </View>
      </View>
    );
  }

  const isSelf = currentUser.id === user.id;
  const theirEvents = events.filter((event) => event.creatorId === user.id);
  const myCreatedEvents = events.filter((event) => event.creatorId === currentUser.id);
  const mutualEvents = getEventsImPartOf().filter(
    (event) => event.creatorId === user.id || event.approvedUserIds.includes(user.id)
  );
  const rating = getUserAverageRating(user.id);
  const crewStatus = getCrewStatus(user.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 24,
          backgroundColor: '#EEF8FF',
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          gap: 18,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <AvatarBubble user={user} size={76} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>
                {user.name}, {user.age}
              </Text>
              {user.verified ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DFF4E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                  <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                  <Text style={{ color: '#15803D', fontSize: 12, fontWeight: '800' }}>Verified</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.muted }}>@{user.username} · {user.city}</Text>
            {user.bio ? <Text style={{ color: colors.muted }}>{user.bio}</Text> : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[
            { label: 'Plans', value: theirEvents.length },
            { label: 'Mutual', value: mutualEvents.length },
            { label: 'Karma', value: rating ? rating.toFixed(1) : 'New' },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{item.value}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Trust snapshot</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <TrustPill label={user.verified ? 'ID verified' : 'Verification pending'} tone="accent" />
            <TrustPill label={rating ? `${rating.toFixed(1)} karma` : 'New to Toogether'} tone="warm" />
            <TrustPill label={mutualEvents.length ? `${mutualEvents.length} mutual plans` : 'No mutual plans yet'} />
            <TrustPill label={`${theirEvents.length} hosted plans`} />
          </View>
        </View>

        {!isSelf ? (
          <GradientButton
            label={
              crewStatus === 'connected'
                ? 'Already in my crew'
                : crewStatus === 'pending_incoming'
                  ? 'Crew request waiting for me'
                  : crewStatus === 'pending_outgoing'
                    ? 'Crew request sent'
                    : 'Add to my crew'
            }
            onPress={() => sendCrewRequest(user.id)}
            fullWidth
            disabled={crewStatus !== 'none'}
          />
        ) : null}

        {mutualEvents.length ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Mutual Plans</Text>
            {mutualEvents.map((event) => (
              <Pressable
                key={event.id}
                onPress={() => router.push(`/event/${event.id}`)}
                style={{ backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Text style={{ fontSize: 26 }}>{event.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{event.title}</Text>
                  <Text style={{ color: colors.muted }}>{event.area}, Guwahati · {event.timeSlot}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>
            ))}
          </View>
        ) : null}

        {theirEvents.length ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
              {user.name.split(' ')[0]}&apos;s Plans
            </Text>
            {theirEvents.map((event) => (
              <Pressable
                key={event.id}
                onPress={() => router.push(`/event/${event.id}`)}
                style={{ backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Text style={{ fontSize: 26 }}>{event.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{event.title}</Text>
                  <Text style={{ color: colors.muted }}>{event.area}, Guwahati · {event.timeSlot}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>
            ))}
          </View>
        ) : null}

        {!isSelf ? (
          <GradientButton
            label="Invite to my event"
            onPress={() => {
              if (myCreatedEvents.length) {
                setShowInviteModal(true);
                return;
              }
              router.push('/create-event');
            }}
            fullWidth
          />
        ) : null}
        {!isSelf && !myCreatedEvents.length ? (
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            Create an event first, then you can invite people into it.
          </Text>
        ) : null}
      </ScrollView>

      <InviteToEventModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        events={myCreatedEvents}
        onSelect={async (eventId) => {
          setShowInviteModal(false);
          try {
            await inviteToEvent(eventId, user.id);
            router.push(`/event/${eventId}`);
          } catch (err) {
            Alert.alert('Could not send invite', err instanceof Error ? err.message : 'Please try again.');
          }
        }}
      />
    </View>
  );
}
