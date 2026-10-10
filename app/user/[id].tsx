import { useLocalSearchParams, router } from 'expo-router';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AvatarBubble } from '@/components/AvatarBubble';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { hasEventStarted } from '@/lib/eventTime';
import { RatingBadge } from '@/components/RatingBadge';
import { formatRating, ratingColor } from '@/lib/rating';

function InviteToEventModal({
  visible,
  onClose,
  events,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  // `status` is set when this person already has a request on that plan, which disables the row.
  events: { id: string; title: string; emoji: string; area: string; status?: string }[];
  onSelect: (eventId: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Invite to my event</Text>
            <Pressable onPress={onClose}>
              <Icon name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={{ color: colors.muted, marginTop: -8 }}>They&apos;ll get a notification and can accept or decline.</Text>
          {events.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => onSelect(event.id)}
              disabled={!!event.status}
              style={{
                backgroundColor: colors.page,
                borderRadius: 18,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: event.status ? 0.55 : 1,
              }}
            >
              <Text style={{ fontSize: 24 }}>{event.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{event.title}</Text>
                <Text style={{ color: colors.muted }}>{event.area}</Text>
              </View>
              {event.status ? (
                <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 12.5 }}>{event.status}</Text>
              ) : (
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function TrustPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'warm' }) {
  const { colors } = useTheme();
  const backgroundColor = tone === 'accent' ? colors.status.info.bg : tone === 'warm' ? colors.status.warning.bg : colors.surface;
  const color = tone === 'accent' ? colors.skyDark : tone === 'warm' ? colors.status.warning.text : colors.text;

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
    acceptCrewRequest,
    removeFromCrew,
    crewRequests,
    requests,
    inviteToEvent,
    showSuccessToast,
  } = useApp();
  const { colors } = useTheme();
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
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="arrow-back" size={18} color={colors.text} />
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
  // Only plans that haven't started can take new people.
  const myCreatedEvents = events.filter((event) => event.creatorId === currentUser.id && !hasEventStarted(event));
  const INVITE_STATUS_LABEL: Partial<Record<string, string>> = {
    invited: 'Invited',
    approved: 'Going',
    pending: 'Asked to join',
  };
  const invitableEvents = myCreatedEvents.map((event) => ({
    ...event,
    status: INVITE_STATUS_LABEL[
      requests.find((request) => request.eventId === event.id && request.userId === user.id)?.status ?? ''
    ],
  }));
  const runCrewAction = (action: () => Promise<void>) => async () => {
    try {
      await action();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  };
  const mutualEvents = getEventsImPartOf().filter(
    (event) => event.creatorId === user.id || event.approvedUserIds.includes(user.id)
  );
  const rating = getUserAverageRating(user.id);
  const crewStatus = getCrewStatus(user.id);
  const incomingCrewRequest = crewRequests.find(
    (request) => request.fromUserId === user.id && request.toUserId === currentUser.id && request.status === 'pending'
  );
  const firstName = user.name.split(' ')[0];
  const confirmThen = (title: string, message: string, confirmLabel: string, action: () => Promise<void>) => () =>
    Alert.alert(title, message, [
      { text: 'Keep', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: runCrewAction(action) },
    ]);
  // Primary action, pinned in the header so it's always on screen. What it does depends on
  // where the two of you stand. The settled states ("In your crew", "Request sent") render as
  // a quieter outline button and tapping them offers to undo.
  const crewAction =
    crewStatus === 'connected'
      ? {
          label: 'In your crew',
          icon: 'checkmark-circle' as const,
          settled: true,
          onPress: confirmThen(
            `Remove ${firstName} from your crew?`,
            "They won't be told. Any invites you haven't heard back on are withdrawn, but plans they've already joined aren't affected.",
            'Remove',
            () => removeFromCrew(user.id)
          ),
        }
      : crewStatus === 'pending_outgoing'
        ? {
            label: 'Crew request sent',
            icon: 'time-outline' as const,
            settled: true,
            onPress: confirmThen('Cancel your crew request?', `${firstName} won't see it anymore.`, 'Cancel request', () =>
              removeFromCrew(user.id)
            ),
          }
        : crewStatus === 'pending_incoming'
          ? {
              label: 'Accept crew request',
              icon: 'person-add-outline' as const,
              settled: false,
              onPress: incomingCrewRequest ? runCrewAction(() => acceptCrewRequest(incomingCrewRequest.id)) : undefined,
            }
          : {
              label: 'Add to my crew',
              icon: 'person-add-outline' as const,
              settled: false,
              onPress: runCrewAction(() => sendCrewRequest(user.id)),
            };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 24,
          backgroundColor: colors.status.info.bg,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          gap: 18,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="arrow-back" size={18} color={colors.text} />
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <AvatarBubble user={user} size={76} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>
                {user.name}, {user.age}
              </Text>
              {user.verified ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.status.info.bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                  <VerifiedBadge size={14} />
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>Verified</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.muted }}>@{user.username} · {user.city}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[
            { label: 'Plans', value: theirEvents.length, color: colors.text },
            { label: 'Mutual', value: mutualEvents.length, color: colors.text },
            { label: 'Rating', value: rating ? `★ ${formatRating(rating)}` : 'New', color: ratingColor(colors, rating) },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 18, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: item.color, fontWeight: '900', fontSize: 18 }}>{item.value}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {!isSelf ? (
          <Pressable
            onPress={crewAction.onPress}
            disabled={!crewAction.onPress}
            style={{
              minHeight: 52,
              borderRadius: 26,
              backgroundColor: crewAction.settled ? colors.card : colors.primary,
              borderWidth: crewAction.settled ? 1 : 0,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon
              name={crewAction.icon}
              size={19}
              color={!crewAction.settled ? '#FFFFFF' : crewStatus === 'connected' ? colors.success : colors.muted}
            />
            <Text style={{ color: !crewAction.settled ? '#FFFFFF' : colors.text, fontSize: 15.5, fontWeight: '900' }}>
              {crewAction.label}
            </Text>
            {crewAction.settled ? <Icon name="chevron-down" size={16} color={colors.muted} /> : null}
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Trust snapshot</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <TrustPill label={user.verified ? 'ID verified' : 'Verification pending'} tone="accent" />
            {rating ? <RatingBadge average={rating} size="md" /> : <TrustPill label="Not rated yet" />}
            <TrustPill label={mutualEvents.length ? `${mutualEvents.length} mutual plans` : 'No mutual plans yet'} />
            <TrustPill label={`${theirEvents.length} hosted plans`} />
          </View>
        </View>


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
                <Icon name="chevron-forward" size={18} color={colors.muted} />
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
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Secondary: inviting is only offered once they're in your crew. */}
        {!isSelf && crewStatus === 'connected' ? (
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => {
                if (myCreatedEvents.length) {
                  setShowInviteModal(true);
                  return;
                }
                router.push('/create-event');
              }}
              style={{
                minHeight: 50,
                borderRadius: 25,
                borderWidth: 1.5,
                borderColor: colors.primary,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon name="calendar-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '800' }}>Invite to my event</Text>
            </Pressable>
            {!myCreatedEvents.length ? (
              <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12.5 }}>
                Create an event first, then you can invite people into it.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <InviteToEventModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        events={invitableEvents}
        onSelect={async (eventId) => {
          setShowInviteModal(false);
          try {
            await inviteToEvent(eventId, user.id);
            showSuccessToast('Invite sent', `${user.name.split(' ')[0]} can accept it from the plan page.`);
          } catch (err) {
            Alert.alert('Could not send invite', err instanceof Error ? err.message : 'Please try again.');
          }
        }}
      />
    </View>
  );
}
