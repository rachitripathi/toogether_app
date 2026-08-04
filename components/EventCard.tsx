import { useState } from 'react';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import type { Event } from '@/lib/types';
import { categoryFontFamily, categoryVisuals } from '@/lib/categoryVisuals';
import { AvatarBubble } from './AvatarBubble';
import { PinMark } from './PinMark';

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
    shouldShowPaywallForJoin,
  } = useApp();
  const [isJoining, setIsJoining] = useState(false);
  const creator = getUserById(event.creatorId);
  const isCreator = currentUser?.id === event.creatorId;
  const requestStatus = getRequestStatus(event.id);
  const config = categoryConfig[event.category] ?? categoryConfig.other;
  const theme = categoryVisuals[event.category] ?? categoryVisuals.other;
  const date = new Date(event.dateTime);
  const dateLabel = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const attendeeCount = event.approvedUserIds?.length + 1;
  const spotsLeft = event.maxPeople ? Math.max(event.maxPeople - attendeeCount, 0) : null;
  const isFull = event.maxPeople ? attendeeCount >= event.maxPeople : false;
  const averageRating = creator ? getUserAverageRating(creator.id) : null;

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
    ? theme.buttonBackground
    : requestStatus === 'approved'
      ? theme.buttonBackground
      : requestStatus === 'pending'
        ? '#FFBE3D'
        : requestStatus === 'rejected' || isFull
          ? '#E5E7EB'
          : theme.buttonBackground;

  const actionTextColor = isCreator
    ? theme.buttonText
    : requestStatus === 'approved'
      ? theme.buttonText
      : requestStatus === 'pending'
        ? '#5B3A00'
        : requestStatus === 'rejected' || isFull
          ? '#6B7280'
          : theme.buttonText;

  const handleAction = async () => {
    if (isCreator || requestStatus === 'approved') {
      router.push(`/event/${event.id}`);
      return;
    }

    if (!requestStatus && !isFull && !isJoining) {
      if (shouldShowPaywallForJoin()) {
        router.push('/paywall');
        return;
      }
      setIsJoining(true);
      try {
        await requestToJoin(event.id);
      } catch (err) {
        console.error('Error requesting to join:', err);
      } finally {
        setIsJoining(false);
      }
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      style={{
        borderRadius: 28,
        minHeight: 230,
        shadowColor: '#D8E1EF',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 7 },
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      <ImageBackground
        source={theme.background}
        resizeMode="cover"
        imageStyle={{ borderRadius: 28 }}
        style={{ minHeight: 230, padding: 16, gap: 14, justifyContent: 'space-between' }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View
            style={{
              backgroundColor: theme.chipBackground,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={{ color: theme.chipText, fontSize: 12, fontWeight: '800', fontFamily: categoryFontFamily }}>
              {config.label}
            </Text>
            {event.womenOnly ? (
              <Text style={{ color: '#BE185D', fontSize: 12, fontWeight: '800', fontFamily: categoryFontFamily }}>Women only</Text>
            ) : null}
          </View>

          {event.pinned ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PinMark color={theme.meta} />
            </View>
          ) : null}

          {spotsLeft !== null ? (
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.82)',
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: theme.title, fontSize: 11, fontWeight: '800', fontFamily: categoryFontFamily }}>
                {spotsLeft} spots left
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ width: '68%', gap: 8 }}>
          <Text style={{ color: theme.title, fontSize: 23, fontWeight: '900', lineHeight: 28, fontFamily: categoryFontFamily }}>
            {event.title}
          </Text>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={14} color={theme.meta} />
              <Text style={{ color: theme.meta, fontWeight: '800', fontFamily: categoryFontFamily }}>
                {dateLabel} · {event.timeSlot}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location-outline" size={14} color={theme.meta} />
              <Text style={{ color: theme.meta, fontWeight: '800', fontFamily: categoryFontFamily }}>{event.area}, Guwahati</Text>
            </View>
          </View>
        </View>

        <View
          style={{
            paddingTop: 13,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.45)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            {creator ? <AvatarBubble user={creator} size={30} /> : null}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: theme.title, fontWeight: '900', fontFamily: categoryFontFamily }}>
                  {isCreator ? 'You' : creator?.name.split(' ')[0]}
                </Text>
                {creator?.verified ? <Ionicons name="checkmark-circle" size={14} color="#16A34A" /> : null}
              </View>
              {creator ? (
                <Text style={{ color: theme.meta, fontSize: 11, fontWeight: '700', fontFamily: categoryFontFamily }}>
                  {creator.age} · {averageRating ? `${averageRating.toFixed(1)}★ karma` : 'New'}
                </Text>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={handleAction}
            disabled={!isCreator && !requestStatus && (isFull || isJoining)}
            style={{
              backgroundColor: actionBackground,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 9,
              shadowColor: requestStatus === 'rejected' || isFull ? '#B8C0CC' : theme.buttonShadow,
              shadowOpacity: requestStatus === 'rejected' || isFull ? 0.14 : 0.28,
              shadowRadius: 9,
              shadowOffset: { width: 0, height: 5 },
              elevation: requestStatus === 'rejected' || isFull ? 1 : 3,
            }}
          >
            <Text style={{ color: actionTextColor, fontWeight: '900', fontSize: 12, fontFamily: categoryFontFamily }}>
              {actionLabel}
            </Text>
          </Pressable>
        </View>
      </ImageBackground>
    </Pressable>
  );
}
