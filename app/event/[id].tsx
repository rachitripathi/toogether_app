import { useLocalSearchParams, router } from 'expo-router';
import { Alert, Animated, ImageBackground, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { AvatarBubble } from '@/components/AvatarBubble';
import { colors } from '@/lib/theme';
import { categoryFontFamily, categoryVisuals, type CategoryVisualTheme } from '@/lib/categoryVisuals';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function InfoRow({
  icon,
  iconColor,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{label}</Text>
    </View>
  );
}

function ThemedActionButton({
  label,
  onPress,
  visual,
  disabled,
}: {
  label: string;
  onPress: () => void;
  visual: CategoryVisualTheme;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 56,
        borderRadius: 28,
        backgroundColor: visual.buttonBackground,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
        shadowColor: visual.buttonShadow,
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 7 },
        elevation: 4,
      }}
    >
      <Text style={{ color: visual.buttonText, fontSize: 16, fontWeight: '900', fontFamily: categoryFontFamily }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerPaddingBottom = scrollY.interpolate({ inputRange: [0, 80], outputRange: [24, 10], extrapolate: 'clamp' });
  const emojiFontSize = scrollY.interpolate({ inputRange: [0, 80], outputRange: [54, 38], extrapolate: 'clamp' });
  const titleFontSize = scrollY.interpolate({ inputRange: [0, 80], outputRange: [28, 22], extrapolate: 'clamp' });
  const chipOpacity = scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: 'clamp' });
  const chipMaxHeight = scrollY.interpolate({ inputRange: [0, 60], outputRange: [40, 0], extrapolate: 'clamp' });
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editLocationNote, setEditLocationNote] = useState('');
  const [editExactTime, setEditExactTime] = useState('');
  const [editTimeSlot, setEditTimeSlot] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Night'>('Evening');
  const [editMaxPeople, setEditMaxPeople] = useState('');
  const [editError, setEditError] = useState('');
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentUser,
    getEventById,
    getUserById,
    getUserAverageRating,
    requestToJoin,
    getRequestStatus,
    approveRequest,
    rejectRequest,
    updateEvent,
    deleteEvent,
    requests,
    categoryConfig,
    shouldShowPaywallForJoin,
    monetisationEnabled,
    isAttendeesUnlocked,
    unlockAttendees,
  } = useApp();

  const event = getEventById(id ?? '');
  if (!event) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page }}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>Event not found</Text>
      </View>
    );
  }

  const creator = getUserById(event.creatorId);
  const isCreator = currentUser?.id === event.creatorId;
  const requestStatus = getRequestStatus(event.id);
  const pendingRequests = requests.filter((request) => request.eventId === event.id && request.status === 'pending');
  const config = categoryConfig[event.category] ?? categoryConfig.other;
  const visual = categoryVisuals[event.category] ?? categoryVisuals.other;
  const date = new Date(event.dateTime);
  const canViewWomenOnly = !event.womenOnly || currentUser?.gender === 'woman' || isCreator;
  const canViewPrivateLayer = isCreator || requestStatus === 'approved';
  const mapUrl =
    event.mapUrl ??
    (event.latitude && event.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
      : undefined);
  const creatorRating = creator ? getUserAverageRating(creator.id) : null;
  const attendeeCount = event.approvedUserIds.length + 1;
  const isFull = event.maxPeople ? attendeeCount >= event.maxPeople : false;
  const attendeesUnlocked = isAttendeesUnlocked(event.id);

  const openEdit = () => {
    setEditTitle(event.title);
    setEditDescription(event.description ?? '');
    setEditArea(event.area);
    setEditLocationNote(event.locationNote ?? '');
    setEditExactTime(event.exactTime);
    setEditTimeSlot(event.timeSlot);
    setEditMaxPeople(event.maxPeople?.toString() ?? '');
    setEditError('');
    setShowEdit(true);
  };

  const saveEdit = () => {
    if (!editTitle.trim()) {
      setEditError('Title cannot be empty.');
      return;
    }
    const parsedMax = editMaxPeople ? Number(editMaxPeople) : undefined;
    if (parsedMax !== undefined && (!Number.isInteger(parsedMax) || parsedMax < 2 || parsedMax > 10)) {
      setEditError('Max people must be a whole number between 2 and 10.');
      return;
    }
    const minMax = event.approvedUserIds.length + 1;
    if (parsedMax !== undefined && parsedMax < minMax) {
      setEditError(`Can't set max below current attendance (${minMax}).`);
      return;
    }
    updateEvent(event.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      area: editArea.trim() || event.area,
      locationNote: editLocationNote.trim(),
      exactTime: editExactTime.trim() || event.exactTime,
      timeSlot: editTimeSlot,
      maxPeople: parsedMax,
    });
    setShowEdit(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Cancel this plan?',
      'This will remove the plan and notify everyone who joined. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Yes, cancel plan',
          style: 'destructive',
          onPress: () => {
            deleteEvent(event.id);
            router.replace('/(tabs)/home');
          },
        },
      ]
    );
  };

  const handleJoin = async () => {
    if (isJoining) {
      return;
    }
    setJoinError('');
    if (shouldShowPaywallForJoin()) {
      router.push('/paywall');
      return;
    }
    setIsJoining(true);
    try {
      await requestToJoin(event.id);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not send the request. Try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleApprove = async (userId: string) => {
    if (processingRequestId) {
      return;
    }
    setProcessingRequestId(userId);
    try {
      await approveRequest(event.id, userId);
    } catch (err) {
      Alert.alert('Could not approve', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (processingRequestId) {
      return;
    }
    setProcessingRequestId(userId);
    try {
      await rejectRequest(event.id, userId);
    } catch (err) {
      Alert.alert('Could not decline', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  if (!canViewWomenOnly) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page, padding: 24 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>Women-only plan</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 8 }}>
          This plan is only visible to women participants.
        </Text>
      </View>
    );
  }

  const statusTone =
    requestStatus === 'approved'
      ? { bg: '#DCFCE7', text: '#15803D', label: 'Approved member', shadow: '#84CC96' }
      : requestStatus === 'pending'
        ? { bg: '#FFBE3D', text: '#5B3A00', label: 'Approval pending', shadow: '#D4860F' }
        : requestStatus === 'rejected'
          ? { bg: '#E5E7EB', text: '#6B7280', label: 'Request declined', shadow: '#B8C0CC' }
          : isCreator
            ? { bg: visual.buttonBackground, text: visual.buttonText, label: 'You are hosting', shadow: visual.buttonShadow }
            : { bg: visual.buttonBackground, text: visual.buttonText, label: 'Open for requests', shadow: visual.buttonShadow };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ImageBackground
        source={visual.background}
        resizeMode="cover"
        imageStyle={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
        style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
      >
        <Animated.View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: headerPaddingBottom, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.75)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {isCreator ? (
              <>
                <Pressable
                  onPress={openEdit}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'rgba(255,255,255,0.75)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'rgba(255,80,80,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </>
            ) : null}
            {(isCreator || requestStatus === 'approved') ? (
              <Pressable
                onPress={() => router.push(`/chat/${event.id}`)}
                style={{
                  backgroundColor: visual.buttonBackground,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  shadowColor: visual.buttonShadow,
                  shadowOpacity: 0.26,
                  shadowRadius: 9,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 3,
                }}
              >
                <Text style={{ color: visual.buttonText, fontWeight: '900', fontFamily: categoryFontFamily }}>Open Chat</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Animated.Text style={{ fontSize: emojiFontSize }}>{event.emoji}</Animated.Text>
          <View style={{ flex: 1, gap: 8 }}>
            <Animated.View style={{ opacity: chipOpacity, maxHeight: chipMaxHeight, overflow: 'hidden' }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: visual.chipBackground,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  gap: 6,
                }}
              >
                <Text style={{ color: visual.chipText, fontSize: 12, fontWeight: '800', fontFamily: categoryFontFamily }}>{config.label}</Text>
                {event.womenOnly ? (
                  <Text style={{ color: '#BE185D', fontSize: 12, fontWeight: '700' }}>Women only</Text>
                ) : null}
              </View>
            </Animated.View>
            <Animated.Text style={{ fontSize: titleFontSize, fontWeight: '900', color: visual.title, fontFamily: categoryFontFamily }}>{event.title}</Animated.Text>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: statusTone.bg,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
                shadowColor: statusTone.shadow,
                shadowOpacity: 0.2,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
            >
              <Text style={{ color: statusTone.text, fontSize: 12, fontWeight: '900', fontFamily: categoryFontFamily }}>{statusTone.label}</Text>
            </View>
          </View>
        </View>
        </Animated.View>
      </ImageBackground>

      <ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 140 }}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 5,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>Schedule</Text>
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <Text style={{ color: colors.muted }}>{event.timeSlot}</Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 5,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>Attendance</Text>
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {event.maxPeople ? `${attendeeCount}/${event.maxPeople}` : attendeeCount}
            </Text>
            <Text style={{ color: colors.muted }}>
              {isFull ? 'Plan is full' : event.maxPeople ? 'Spots still open' : 'Open-size hangout'}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Plan snapshot</Text>
          <InfoRow
            icon="time-outline"
            iconColor={colors.primary}
            label={`${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · ${event.timeSlot}`}
          />
          <InfoRow icon="location-outline" iconColor={colors.secondary} label={`${event.area}, Guwahati`} />
          {event.locationNote ? (
            <InfoRow icon="information-circle-outline" iconColor="#16A34A" label={event.locationNote} />
          ) : null}
          {event.maxPeople ? <InfoRow icon="people-outline" iconColor="#16A34A" label={`${attendeeCount} going so far`} /> : null}
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Private details</Text>
            <View
              style={{
                backgroundColor: canViewPrivateLayer ? '#DCFCE7' : '#EEF2F7',
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: canViewPrivateLayer ? '#15803D' : colors.muted, fontSize: 12, fontWeight: '700' }}>
                {canViewPrivateLayer ? 'Unlocked' : 'Locked'}
              </Text>
            </View>
          </View>
          {canViewPrivateLayer ? (
            <View style={{ gap: 10 }}>
              <InfoRow icon="time" iconColor="#1D9E75" label={`Exact meeting time: ${event.exactTime}`} />
              <InfoRow icon="navigate" iconColor="#1D9E75" label={event.exactLocation} />
              {mapUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(mapUrl)}
                  style={{
                    backgroundColor: '#E0F2FE',
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="map-outline" size={20} color={colors.skyDark} />
                    <Text style={{ color: colors.skyDark, fontWeight: '800' }}>Open pinned location in Maps</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.skyDark} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                Exact address and time unlock after the host approves your join request.
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                This keeps spontaneous plans safer while still letting people discover them publicly.
              </Text>
            </View>
          )}
        </View>

        {event.description ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>About</Text>
            <Text style={{ color: colors.muted, lineHeight: 22 }}>{event.description}</Text>
          </View>
        ) : null}

        {creator ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Hosted by</Text>
            <Pressable onPress={() => router.push(`/user/${creator.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AvatarBubble user={creator} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{creator.name}</Text>
                <Text style={{ color: colors.muted }}>@{creator.username}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {creator.age} · {creatorRating ? `${creatorRating.toFixed(1)}★ karma` : 'New'}
                  {creator.verified ? ' · Verified' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
            </Pressable>
          </View>
        ) : null}

        {event.approvedUserIds.length ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
              Going ({event.approvedUserIds.length})
            </Text>
            {!monetisationEnabled ? (
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 18, padding: 14 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{event.approvedUserIds.length} confirmed so far</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  Full attendee details unlock after you are part of the plan.
                </Text>
              </View>
            ) : !attendeesUnlocked ? (
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 18, padding: 14, gap: 10 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{event.approvedUserIds.length} people are going</Text>
                <Text style={{ color: colors.muted, lineHeight: 20 }}>
                  Phase 2 preview: unlock the attendee list for 1 credit.
                </Text>
                <Pressable
                  onPress={() => {
                    const unlocked = unlockAttendees(event.id);
                    if (!unlocked) {
                      router.push('/paywall');
                    }
                  }}
                  style={{ backgroundColor: visual.buttonBackground, borderRadius: 999, paddingVertical: 11, alignItems: 'center' }}
                >
                  <Text style={{ color: visual.buttonText, fontWeight: '900' }}>Unlock for 1 credit</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {event.approvedUserIds.map((userId) => {
                  const user = getUserById(userId);
                  if (!user) return null;
                  return (
                    <Pressable
                      key={userId}
                      onPress={() => router.push(`/user/${userId}`)}
                      style={{
                        backgroundColor: colors.page,
                        borderRadius: 999,
                        padding: 8,
                        paddingRight: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AvatarBubble user={user} size={28} />
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{user.name.split(' ')[0]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {isCreator ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
              Join Requests {pendingRequests.length ? `(${pendingRequests.length})` : ''}
            </Text>
            {pendingRequests.length ? (
              pendingRequests.map((request) => {
                const user = getUserById(request.userId);
                if (!user) return null;
                return (
                  <View
                    key={request.id}
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: 18,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <AvatarBubble user={user} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>{user.name}</Text>
                      <Text style={{ color: colors.muted }}>
                        @{user.username} · {user.verified ? 'Verified' : 'Unverified'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleReject(user.id)}
                      disabled={processingRequestId === user.id}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#FFE4E6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: processingRequestId === user.id ? 0.5 : 1,
                      }}
                    >
                      <Ionicons name="close" size={18} color={colors.danger} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleApprove(user.id)}
                      disabled={processingRequestId === user.id}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#DCFCE7',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: processingRequestId === user.id ? 0.5 : 1,
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#16A34A" />
                    </Pressable>
                  </View>
                );
              })
            ) : (
              <Text style={{ color: colors.muted }}>No pending requests right now.</Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      {!isCreator ? (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 16) + 12, gap: 8 }}>
          {joinError ? (
            <View
              style={{
                backgroundColor: '#FFF7E8',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#FDE7B3',
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="warning-outline" size={16} color="#B45309" />
              <Text style={{ color: '#B45309', fontWeight: '700', flex: 1, fontSize: 13 }}>{joinError}</Text>
            </View>
          ) : null}
          {requestStatus === 'approved' ? (
            <ThemedActionButton label="Open Chat" onPress={() => router.push(`/chat/${event.id}`)} visual={visual} />
          ) : requestStatus === 'pending' ? (
            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 24, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#B45309', fontWeight: '800' }}>Request Pending</Text>
            </View>
          ) : requestStatus === 'rejected' ? (
            <View style={{ backgroundColor: '#E5E7EB', borderRadius: 24, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontWeight: '800' }}>Not this time</Text>
            </View>
          ) : isFull ? (
            <View style={{ backgroundColor: '#E5E7EB', borderRadius: 24, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontWeight: '800' }}>This plan is full</Text>
            </View>
          ) : (
            <ThemedActionButton
              label={isJoining ? 'Sending request...' : 'Request to Join'}
              onPress={handleJoin}
              disabled={isJoining}
              visual={visual}
            />
          )}
        </View>
      ) : null}

      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              gap: 16,
              maxHeight: '90%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Edit plan</Text>
              <Pressable onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
              <FormField label="Title" value={editTitle} onChangeText={setEditTitle} placeholder="Event title" />
              <FormField
                label="Description"
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="What's the vibe?"
                multiline
              />
              <FormField label="Locality shown publicly" value={editArea} onChangeText={setEditArea} placeholder="Area" />
              <FormField label="Exact time" value={editExactTime} onChangeText={setEditExactTime} placeholder="7:00 PM" />
              <FormField
                label="Location note"
                value={editLocationNote}
                onChangeText={setEditLocationNote}
                placeholder="Near main entrance, easy parking"
              />
              <FormField
                label="Max people"
                value={editMaxPeople}
                onChangeText={setEditMaxPeople}
                keyboardType="numeric"
                placeholder="2 to 10"
              />

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Time of day</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {(['Morning', 'Afternoon', 'Evening', 'Night'] as const).map((slot) => {
                    const active = slot === editTimeSlot;
                    return (
                      <Pressable
                        key={slot}
                        onPress={() => setEditTimeSlot(slot)}
                        style={{
                          backgroundColor: active ? '#FFF1D6' : colors.surface,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          borderRadius: 999,
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                        }}
                      >
                        <Text style={{ color: active ? '#B45309' : colors.text, fontWeight: '700' }}>{slot}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {editError ? (
                <Text style={{ color: colors.danger, fontWeight: '700' }}>{editError}</Text>
              ) : null}

              <GradientButton label="Save changes" onPress={saveEdit} fullWidth />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
