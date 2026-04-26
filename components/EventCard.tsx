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
  const {
    currentUser,
    getRequestStatus,
    requestToJoin,
    getUserById,
    getUserAverageRating,
    categoryConfig,
  } = useApp();
  const creator = getUserById(event.creatorId);
  const isCreator = currentUser?.id === event.creatorId;
  const requestStatus = getRequestStatus(event.id);
  const config = categoryConfig[event.category] ?? categoryConfig.other;
  const date = new Date(event.dateTime);
  const dateLabel = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const attendeeCount = event.approvedUserIds.length + 1;
  const spotsLeft = event.maxPeople ? Math.max(event.maxPeople - attendeeCount, 0) : null;
  const isFull = event.maxPeople ? attendeeCount >= event.maxPeople : false;
  const averageRating = creator ? getUserAverageRating(creator.id) : null;
  const cardBackground = event.pinned ? '#FFF2C9' : config.chipBackground;

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
          : isFull
            ? 'Full'
            : 'Request to Join';

  const actionBackground = isCreator
    ? '#E0F2FE'
    : requestStatus === 'approved'
      ? '#DCFCE7'
      : requestStatus === 'pending'
        ? '#FEF3C7'
        : requestStatus === 'rejected'
          ? '#F3F4F6'
          : isFull
            ? '#E5E7EB'
            : '#FFF1D6';

  const actionTextColor = isCreator
    ? colors.skyDark
    : requestStatus === 'approved'
      ? '#15803D'
      : requestStatus === 'pending'
        ? '#B45309'
        : requestStatus === 'rejected'
          ? '#6B7280'
          : isFull
            ? '#6B7280'
            : '#B45309';

  const handleAction = () => {
    if (isCreator || requestStatus === 'approved') {
      router.push(`/event/${event.id}`);
      return;
    }

    if (!requestStatus && !isFull) {
      requestToJoin(event.id);
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      style={{
        backgroundColor: cardBackground,
        borderRadius: 28,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E9EEF3',
        gap: 14,
        shadowColor: '#CFD8E3',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.68)',
            }}
          >
            <Text style={{ fontSize: 22 }}>{event.emoji}</Text>
          </View>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.68)',
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

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {event.pinned ? (
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#222832',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="pin" size={12} color="#FFFFFF" />
            </View>
          ) : null}
          {spotsLeft !== null ? <Text style={{ color: colors.muted, fontSize: 12 }}>{spotsLeft} spots left</Text> : null}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{event.title}</Text>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calendar-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted }}>
              {dateLabel} · {event.timeSlot}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="location-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted }}>{event.area}, Guwahati</Text>
          </View>
        </View>
      </View>

      <View
        style={{
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.74)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {creator ? <AvatarBubble user={creator} size={30} /> : null}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {isCreator ? 'You' : creator?.name.split(' ')[0]}
              </Text>
              {creator?.verified ? <Ionicons name="checkmark-circle" size={14} color="#16A34A" /> : null}
            </View>
            {creator ? (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {creator.age} · {averageRating ? `${averageRating.toFixed(1)}★ karma` : 'New'}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={handleAction}
          disabled={!isCreator && !requestStatus && isFull}
          style={{
            backgroundColor: actionBackground,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.58)',
          }}
        >
          <Text style={{ color: actionTextColor, fontWeight: '800', fontSize: 12 }}>{actionLabel}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
