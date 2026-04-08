import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import type { Event } from '@/lib/types';
import { AvatarBubble } from './AvatarBubble';

type EventCardProps = {
  event: Event;
};

export function EventCard({ event }: EventCardProps) {
  const { currentUser, getRequestStatus, requestToJoin, getUserById, categoryConfig } = useApp();
  const creator = getUserById(event.creatorId);
  const isCreator = currentUser?.id === event.creatorId;
  const requestStatus = getRequestStatus(event.id);
  const config = categoryConfig[event.category] ?? categoryConfig.other;
  const date = new Date(event.dateTime);
  const dateLabel = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const timeLabel = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const spotsLeft = event.maxPeople ? event.maxPeople - event.approvedUserIds.length : null;

  if (event.womenOnly && currentUser?.gender !== 'woman' && !isCreator) {
    return null;
  }

  const actionLabel = isCreator
    ? 'Manage'
    : requestStatus === 'approved'
      ? 'Joined'
      : requestStatus === 'pending'
        ? 'Pending'
        : requestStatus === 'rejected'
          ? 'Declined'
          : 'Join';

  const actionBackground = isCreator
    ? '#EEF2FF'
    : requestStatus === 'approved'
      ? '#DCFCE7'
      : requestStatus === 'pending'
        ? '#FEF3C7'
        : requestStatus === 'rejected'
          ? '#F3F4F6'
          : '#EEF2FF';

  const actionTextColor = isCreator
    ? '#4F46E5'
    : requestStatus === 'approved'
      ? '#15803D'
      : requestStatus === 'pending'
        ? '#B45309'
        : requestStatus === 'rejected'
          ? '#6B7280'
          : '#4F46E5';

  const handleAction = () => {
    if (isCreator || requestStatus === 'approved') {
      router.push(`/event/${event.id}`);
      return;
    }
    if (!requestStatus) {
      requestToJoin(event.id);
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: config.iconBackground,
            }}
          >
            <Text style={{ fontSize: 22 }}>{event.emoji}</Text>
          </View>
        <View
            style={{
              backgroundColor: config.chipBackground,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={{ color: config.chipText, fontSize: 12, fontWeight: '700' }}>{config.label}</Text>
            {event.womenOnly ? (
              <Text style={{ color: '#BE185D', fontSize: 12, fontWeight: '700' }}>Women only</Text>
            ) : null}
          </View>
        </View>
        {spotsLeft !== null ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>{spotsLeft} spots left</Text>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{event.title}</Text>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted }}>{dateLabel} · {timeLabel}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="location-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted }}>{event.location}</Text>
          </View>
        </View>
      </View>

      <View
        style={{
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {creator ? <AvatarBubble user={creator} size={30} /> : null}
          <Text style={{ color: colors.muted, fontWeight: '600' }}>
            {isCreator ? 'You' : creator?.name.split(' ')[0]}
          </Text>
        </View>

        <Pressable
          onPress={handleAction}
          style={{
            backgroundColor: actionBackground,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: actionTextColor, fontWeight: '800', fontSize: 12 }}>{actionLabel}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
