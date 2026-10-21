import { useLocalSearchParams, router } from 'expo-router';
import { Alert, Animated, BackHandler, ImageBackground, LayoutAnimation, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/Icon';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { AvatarBubble } from '@/components/AvatarBubble';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { SafetyTipsSheet } from '@/components/SafetyTipsSheet';
import { EventDetailSkeleton } from '@/components/SkeletonLoaders/EventDetailSkeleton';
import { PlanClosedScreen } from '@/components/PlanClosedScreen';
import { formatClockTime, hasEventStarted, isEventArchived, timeSlotFor } from '@/lib/eventTime';
import { useTheme } from '@/providers/ThemeProvider';
import { lightColors } from '@/lib/theme';
import { categoryFontFamily, categoryFontWeight, categoryVisuals, type CategoryVisualTheme } from '@/lib/categoryVisuals';
import { useApp } from '@/providers/AppProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { UnreadBadge } from '@/components/UnreadBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { keyboardCoveredHeight } from '@/utils/keyboardInset';
import { MAX_JOIN_REQUEST_ATTEMPTS, type User } from '@/lib/types';
import { PLAN_LIMITS, cleanMultiline } from '@/lib/profileFields';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { KarmaBadge } from '@/components/KarmaBadge';

// The back/edit buttons sit on translucent white chips (rgba(255,255,255,0.75)) laid
// over the category art photo — that chip stays white regardless of app theme (it needs
// to read against varied photo backgrounds, not the page), so its icon must be a pinned
// dark color too. Using colors.text there would go near-white in dark mode and vanish.
const ON_LIGHT_CHIP_ICON = '#1A1D2E';

function InfoRow({
  icon,
  iconColor,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Icon name={icon} size={20} color={iconColor} />
      <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{label}</Text>
    </View>
  );
}

function ThemedActionButton({
  label,
  onPress,
  visual,
  disabled,
  badgeCount = 0,
}: {
  label: string;
  onPress: () => void;
  visual: CategoryVisualTheme;
  disabled?: boolean;
  badgeCount?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 56,
        borderRadius: 28,
        backgroundColor: visual.buttonBackground,
        flexDirection: 'row',
        gap: 8,
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
      <Text style={{ color: visual.buttonText, fontSize: 16, fontWeight: categoryFontWeight('900'), fontFamily: categoryFontFamily }}>
        {label}
      </Text>
      <UnreadBadge count={badgeCount} />
    </Pressable>
  );
}

// Accept / decline / remove. Solid fills with white text so they stay readable on any card in
// either theme (the translucent status tints these used to use looked see-through in dark mode).
function SolidActionButton({
  label,
  icon,
  color,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: color,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 9,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon name={icon} size={15} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function PersonRow({ user, children }: { user: User; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable onPress={() => router.push(`/user/${user.id}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <AvatarBubble user={user} size={40} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', flexShrink: 1 }}>{user.name}</Text>
            {user.verified ? <VerifiedBadge size={12} /> : null}
          </View>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12.5 }}>@{user.username}</Text>
        </View>
      </Pressable>
      {children}
    </View>
  );
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();
  const { getUnreadChatCount } = useNotifications();
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerPaddingBottom = scrollY.interpolate({ inputRange: [0, 80], outputRange: [24, 10], extrapolate: 'clamp' });
  const emojiFontSize = scrollY.interpolate({ inputRange: [0, 80], outputRange: [54, 38], extrapolate: 'clamp' });
  const titleFontSize = scrollY.interpolate({ inputRange: [0, 80], outputRange: [28, 22], extrapolate: 'clamp' });
  const chipOpacity = scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: 'clamp' });
  const chipMaxHeight = scrollY.interpolate({ inputRange: [0, 60], outputRange: [40, 0], extrapolate: 'clamp' });
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [requestsExpanded, setRequestsExpanded] = useState(false);
  const [showInviteCrew, setShowInviteCrew] = useState(false);
  const [isAnsweringInvite, setIsAnsweringInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSafetyTips, setShowSafetyTips] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editStart, setEditStart] = useState<Date | null>(null);
  const [showIosTimePicker, setShowIosTimePicker] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const keyboardHeight = useKeyboardHeight();

  // The edit sheet is an in-screen overlay, not a <Modal>, so Android's back button has to be
  // wired up by hand.
  useEffect(() => {
    if (!showEdit) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowEdit(false);
      return true;
    });
    return () => subscription.remove();
  }, [showEdit]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentUser,
    getEventById,
    getUserById,
    getUserKarma,
    requestToJoin,
    getRequestStatus,
    getRequestAttempts,
    rerequestToJoin,
    approveRequest,
    rejectRequest,
    removeMember,
    inviteToEvent,
    respondToInvite,
    getCrewMembers,
    showSuccessToast,
    updateEvent,
    deleteEvent,
    requests,
    categoryConfig,
    shouldShowPaywallForJoin,
    monetisationEnabled,
    isAttendeesUnlocked,
    unlockAttendees,
    isLoadingEvents,
  } = useApp();

  const event = getEventById(id ?? '');
  if (!event) {
    // Opened straight from a push (cold start or resume), this screen can mount before the
    // feed sync finishes — only call it "not found" once that sync has actually come back.
    if (isLoadingEvents) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.page, paddingTop: insets.top }}>
          <EventDetailSkeleton />
        </View>
      );
    }
    return <PlanClosedScreen />;
  }

  const creator = getUserById(event.creatorId);
  const isCreator = currentUser?.id === event.creatorId;
  const requestStatus = getRequestStatus(event.id);
  const requestsLeft = Math.max(MAX_JOIN_REQUEST_ATTEMPTS - getRequestAttempts(event.id), 0);
  const requestStatusFor = (userId: string) =>
    requests.find((request) => request.eventId === event.id && request.userId === userId)?.status;
  const invitedUsers = requests
    .filter((request) => request.eventId === event.id && request.status === 'invited')
    .map((request) => getUserById(request.userId))
    .filter((user): user is User => !!user);
  const pendingRequesters = requests
    .filter((request) => request.eventId === event.id && request.status === 'pending')
    .map((request) => getUserById(request.userId))
    .filter((user): user is User => !!user);
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
  const creatorKarma = creator ? getUserKarma(creator.id)?.karma ?? null : null;
  const attendeeCount = event.approvedUserIds.length + 1;
  const isFull = event.maxPeople ? attendeeCount >= event.maxPeople : false;
  const attendeesUnlocked = isAttendeesUnlocked(event.id);

  // After posting, only the start time (same day) and description can change; everything else
  // is fixed so a plan people joined can't turn into a different plan. Enforced server-side by
  // restrict_event_edits() (migration 017). Not offered once the plan has started.
  const canEdit = isCreator && !hasEventStarted(event);
  const originalStart = new Date(event.dateTime);

  const openEdit = () => {
    setEditDescription(event.description ?? '');
    setEditStart(originalStart);
    setShowIosTimePicker(false);
    setEditError('');
    setShowEdit(true);
  };

  // Keeps the plan's date and takes only the hours/minutes from the picker.
  const applyPickedTime = (picked: Date) => {
    const next = new Date(originalStart);
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    setEditStart(next);
    setEditError('');
  };

  const openTimePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: editStart ?? originalStart,
        mode: 'time',
        onChange: (_e, picked) => {
          if (picked) applyPickedTime(picked);
        },
      });
      return;
    }
    setShowIosTimePicker((value) => !value);
  };

  const saveEdit = async () => {
    if (!editStart || isSavingEdit) {
      return;
    }
    const timeChanged = editStart.getTime() !== originalStart.getTime();
    if (timeChanged && editStart.getTime() < Date.now() + PLAN_LIMITS.minLeadMinutes * 60 * 1000) {
      setEditError(`Pick a time at least ${PLAN_LIMITS.minLeadMinutes} minutes from now.`);
      return;
    }
    const description = cleanMultiline(editDescription);
    if (!timeChanged && description === (event.description ?? '')) {
      setShowEdit(false);
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateEvent(event.id, {
        description,
        ...(timeChanged
          ? { dateTime: editStart.toISOString(), exactTime: formatClockTime(editStart), timeSlot: timeSlotFor(editStart) }
          : {}),
      });
      setShowEdit(false);
      if (timeChanged && event.approvedUserIds.length) {
        showSuccessToast('Time updated', 'Everyone who joined has been notified.');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setIsSavingEdit(false);
    }
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

  const handleRerequest = async () => {
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
      await rerequestToJoin(event.id);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not send the request. Try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleRemoveMember = (member: User) => {
    Alert.alert(
      `Remove ${member.name.split(' ')[0]}?`,
      "They'll lose access to the chat and the plan's details, and won't be able to request this plan again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProcessingRequestId(member.id);
            try {
              await removeMember(event.id, member.id);
            } catch (err) {
              Alert.alert('Could not remove', err instanceof Error ? err.message : 'Please try again.');
            } finally {
              setProcessingRequestId(null);
            }
          },
        },
      ]
    );
  };

  const handleInvite = async (member: User) => {
    setProcessingRequestId(member.id);
    try {
      await inviteToEvent(event.id, member.id);
      showSuccessToast('Invite sent', `${member.name.split(' ')[0]} can accept it from this plan's page.`);
    } catch (err) {
      Alert.alert('Could not send invite', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRespondToInvite = async (accept: boolean) => {
    if (isAnsweringInvite) {
      return;
    }
    setJoinError('');
    setIsAnsweringInvite(true);
    try {
      await respondToInvite(event.id, accept);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setIsAnsweringInvite(false);
    }
  };

  const toggleRequests = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRequestsExpanded((value) => !value);
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

  // Archived 6h after start: only the host and members still get the row (RLS), and even they
  // just see that it happened. Details, members and chat are closed.
  if (isEventArchived(event)) {
    return <PlanClosedScreen event={event} />;
  }

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

  // This pill sits on the category header image, which looks the same in light and dark mode, so
  // the approved/declined tones are solid and theme-independent. The theme's status tokens are
  // translucent in dark mode and turned into faint text over the image.
  const closedTone = { bg: 'rgba(255,255,255,0.9)', text: '#475569', shadow: '#64748B' };
  const statusTone =
    requestStatus === 'approved'
      ? { bg: '#15803D', text: '#FFFFFF', label: 'Approved member', shadow: '#15803D' }
      : requestStatus === 'pending'
        ? { bg: colors.solid.pending, text: '#FFFFFF', label: 'Approval pending', shadow: colors.solid.pending }
        : requestStatus === 'rejected'
          ? { ...closedTone, label: 'Request declined' }
          : requestStatus === 'removed'
            ? { ...closedTone, label: 'Removed from plan' }
            : requestStatus === 'invited'
              ? { bg: visual.buttonBackground, text: visual.buttonText, label: "You're invited", shadow: visual.buttonShadow }
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
            <Icon name="arrow-back" size={18} color={ON_LIGHT_CHIP_ICON} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {isCreator ? (
              <>
                {canEdit ? (
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
                    <Icon name="create-outline" size={18} color={ON_LIGHT_CHIP_ICON} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={handleDelete}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'rgba(255,255,255,0.75)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="trash-outline" size={18} color={lightColors.status.danger.text} />
                </Pressable>
              </>
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
                <Text style={{ color: visual.chipText, fontSize: 12, fontWeight: categoryFontWeight('800'), fontFamily: categoryFontFamily }}>{config.label}</Text>
                {event.womenOnly ? (
                  <Text style={{ color: '#BE185D', fontSize: 12, fontWeight: '700' }}>Women only</Text>
                ) : null}
              </View>
            </Animated.View>
            <Animated.Text style={{ fontSize: titleFontSize, fontWeight: categoryFontWeight('900'), color: visual.title, fontFamily: categoryFontFamily }}>{event.title}</Animated.Text>
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
              <Text style={{ color: statusTone.text, fontSize: 12, fontWeight: categoryFontWeight('900'), fontFamily: categoryFontFamily }}>{statusTone.label}</Text>
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
        {/* Host only: everyone waiting for a decision, folded into one card right under the banner. */}
        {isCreator && pendingRequesters.length ? (
          // Amber "attention" fill instead of an outline, so it reads as "needs you". In light mode
          // colors.card and colors.page are both white, so a plain card blended into the page.
          <View style={{ backgroundColor: colors.attention, borderRadius: 24 }}>
            <Pressable onPress={toggleRequests} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.solid.pending,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="person-add-outline" size={19} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>
                  {pendingRequesters.length === 1
                    ? `${pendingRequesters[0].name.split(' ')[0]} wants to join`
                    : `${pendingRequesters.length} people want to join`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {pendingRequesters.slice(0, 4).map((user, index) => (
                      <View key={user.id} style={{ marginLeft: index ? -8 : 0, borderRadius: 12, borderWidth: 2, borderColor: colors.attention }}>
                        <AvatarBubble user={user} size={20} />
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12.5 }}>{requestsExpanded ? 'Tap to collapse' : 'Tap to review'}</Text>
                </View>
              </View>
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: 12,
                  paddingHorizontal: 7,
                  backgroundColor: colors.solid.pending,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>{pendingRequesters.length}</Text>
              </View>
              <Icon
                name="chevron-down"
                size={18}
                color={colors.muted}
                style={{ transform: [{ rotate: requestsExpanded ? '180deg' : '0deg' }] }}
              />
            </Pressable>
            {requestsExpanded ? (
              <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 8 }}>
                {pendingRequesters.map((user) => (
                  <View key={user.id} style={{ backgroundColor: colors.card, borderRadius: 18, padding: 10, ...shadow.card }}>
                    <PersonRow user={user}>
                      <SolidActionButton
                        label="Decline"
                        icon="close"
                        color={colors.solid.decline}
                        onPress={() => handleReject(user.id)}
                        disabled={processingRequestId === user.id}
                      />
                      <SolidActionButton
                        label="Accept"
                        icon="checkmark"
                        color={colors.solid.accept}
                        onPress={() => handleApprove(user.id)}
                        disabled={processingRequestId === user.id}
                      />
                    </PersonRow>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 22,
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

        <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 14 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Plan snapshot</Text>
          <InfoRow
            icon="time-outline"
            iconColor={colors.primary}
            label={`${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · ${event.timeSlot}`}
          />
          <InfoRow icon="location-outline" iconColor={colors.secondary} label={`${event.area}, Guwahati`} />
          {event.locationNote ? (
            <InfoRow icon="information-circle-outline" iconColor={colors.success} label={event.locationNote} />
          ) : null}
          {event.maxPeople ? <InfoRow icon="people-outline" iconColor={colors.success} label={`${attendeeCount} going so far`} /> : null}
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Private details</Text>
            <View
              style={{
                backgroundColor: canViewPrivateLayer ? colors.status.success.bg : colors.surface,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: canViewPrivateLayer ? colors.status.success.text : colors.muted, fontSize: 12, fontWeight: '700' }}>
                {canViewPrivateLayer ? 'Unlocked' : 'Locked'}
              </Text>
            </View>
          </View>
          {canViewPrivateLayer ? (
            <View style={{ gap: 10 }}>
              <InfoRow icon="time" iconColor={colors.success} label={`Exact meeting time: ${event.exactTime}`} />
              <InfoRow icon="navigate" iconColor={colors.success} label={event.exactLocation} />
              {mapUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(mapUrl)}
                  style={{
                    backgroundColor: colors.status.info.bg,
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
                    <Icon name="map-outline" size={20} color={colors.skyDark} />
                    <Text style={{ color: colors.skyDark, fontWeight: '800' }}>Open pinned location in Maps</Text>
                  </View>
                  <Icon name="open-outline" size={18} color={colors.skyDark} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setShowSafetyTips(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 4 }}
              >
                <Icon name="shield-checkmark-outline" size={16} color={colors.muted} />
                <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>Meeting up safely — tips</Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.card,
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
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>About</Text>
            <Text style={{ color: colors.muted, lineHeight: 22 }}>{event.description}</Text>
          </View>
        ) : null}

        {creator ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Hosted by</Text>
            <Pressable onPress={() => router.push(`/user/${creator.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AvatarBubble user={creator} size={48} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{creator.name}</Text>
                  {creator.verified ? <VerifiedBadge size={13} /> : null}
                </View>
                <Text style={{ color: colors.muted }}>@{creator.username}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{creator.age}</Text>
                  <KarmaBadge karma={creatorKarma} />
                </View>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        {event.approvedUserIds.length || isCreator ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                {isCreator ? 'Members' : 'Going'} ({event.approvedUserIds.length})
              </Text>
              {isCreator && !isFull ? (
                <Pressable
                  onPress={() => setShowInviteCrew(true)}
                  hitSlop={6}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
                >
                  <Icon name="person-add-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13.5 }}>Invite crew</Text>
                </Pressable>
              ) : null}
            </View>
            {isCreator ? (
              // The host always sees and manages the full member list, regardless of credits.
              <View style={{ gap: 12 }}>
                {!event.approvedUserIds.length && !invitedUsers.length ? (
                  <Text style={{ color: colors.muted }}>No one has joined yet. Invite people from your crew.</Text>
                ) : null}
                {event.approvedUserIds.map((userId) => {
                  const member = getUserById(userId);
                  if (!member) return null;
                  return (
                    <PersonRow key={userId} user={member}>
                      <SolidActionButton
                        label="Remove"
                        icon="close"
                        color={colors.solid.decline}
                        onPress={() => handleRemoveMember(member)}
                        disabled={processingRequestId === member.id}
                      />
                    </PersonRow>
                  );
                })}
                {invitedUsers.map((invitee) => (
                  <PersonRow key={invitee.id} user={invitee}>
                    <View style={{ backgroundColor: colors.status.warning.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: colors.status.warning.text, fontWeight: '800', fontSize: 12 }}>Invited · waiting</Text>
                    </View>
                  </PersonRow>
                ))}
              </View>
            ) : requestStatus === 'approved' ? (
              // Members see everyone else who's going (RLS since migration 018), host first.
              <View style={{ gap: 12 }}>
                {[event.creatorId, ...event.approvedUserIds].map((userId) => {
                  const person = getUserById(userId);
                  if (!person) return null;
                  return (
                    <PersonRow key={userId} user={person}>
                      {userId === event.creatorId ? (
                        <Text style={{ color: colors.status.info.text, fontWeight: '800', fontSize: 12 }}>Host</Text>
                      ) : userId === currentUser?.id ? (
                        <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 12 }}>You</Text>
                      ) : null}
                    </PersonRow>
                  );
                })}
              </View>
            ) : !monetisationEnabled ? (
              <View style={{ backgroundColor: colors.inset, borderRadius: 18, padding: 14 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{event.approvedUserIds.length} confirmed so far</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  Full attendee details unlock after you are part of the plan.
                </Text>
              </View>
            ) : !attendeesUnlocked ? (
              <View style={{ backgroundColor: colors.inset, borderRadius: 18, padding: 14, gap: 10 }}>
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
                        backgroundColor: colors.inset,
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
            {isCreator || requestStatus === 'approved' ? (
              <Pressable
                onPress={() => router.push(`/event-members/${event.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, alignSelf: 'flex-start' }}
              >
                <Icon name="flag-outline" size={15} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13.5 }}>
                  {isCreator ? 'Manage members & reports' : 'Members & reporting'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

      </ScrollView>

      {/* One Open Chat entry point for host and approved members alike, pinned at the bottom. */}
      {isCreator ? (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 16) + 12 }}>
          <ThemedActionButton
            label="Open Chat"
            onPress={() => router.push(`/chat/${event.id}`)}
            visual={visual}
            badgeCount={getUnreadChatCount(event.id)}
          />
        </View>
      ) : (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 16) + 12, gap: 8 }}>
          {joinError ? (
            <View
              style={{
                backgroundColor: colors.status.warning.bg,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="warning-outline" size={16} color={colors.status.warning.text} />
              <Text style={{ color: colors.status.warning.text, fontWeight: '700', flex: 1, fontSize: 13 }}>{joinError}</Text>
            </View>
          ) : null}
          {requestStatus === 'invited' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => handleRespondToInvite(false)}
                disabled={isAnsweringInvite}
                style={{
                  minHeight: 56,
                  paddingHorizontal: 22,
                  borderRadius: 28,
                  backgroundColor: colors.solid.decline,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isAnsweringInvite ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16 }}>Decline</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <ThemedActionButton
                  label={isAnsweringInvite ? 'Saving...' : 'Accept invite'}
                  onPress={() => handleRespondToInvite(true)}
                  disabled={isAnsweringInvite}
                  visual={visual}
                />
              </View>
            </View>
          ) : requestStatus === 'approved' ? (
            <ThemedActionButton
              label="Open Chat"
              onPress={() => router.push(`/chat/${event.id}`)}
              visual={visual}
              badgeCount={getUnreadChatCount(event.id)}
            />
          ) : requestStatus === 'pending' ? (
            <View style={{ backgroundColor: colors.solid.pending, borderRadius: 24, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Request Pending</Text>
            </View>
          ) : requestStatus === 'rejected' && requestsLeft > 0 && !isFull ? (
            <ThemedActionButton
              label={isJoining ? 'Sending request...' : `Request again · ${requestsLeft} ${requestsLeft === 1 ? 'try' : 'tries'} left`}
              onPress={handleRerequest}
              disabled={isJoining}
              visual={visual}
            />
          ) : requestStatus === 'rejected' || requestStatus === 'removed' ? (
            <View style={{ backgroundColor: colors.border, borderRadius: 24, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontWeight: '800' }}>
                {requestStatus === 'removed' ? 'You were removed from this plan' : 'Not this time'}
              </Text>
            </View>
          ) : isFull ? (
            <View style={{ backgroundColor: colors.border, borderRadius: 24, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontWeight: '800' }}>This plan is full</Text>
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
      )}

      {/* Rendered in this screen's own window rather than a <Modal>: on Android a Modal is a
          separate dialog window whose keyboard never reaches RN's Keyboard events, so the sheet
          couldn't move out of the keyboard's way. Here it's lifted by the covered height. */}
      {showEdit ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
            paddingBottom: keyboardCoveredHeight({ os: Platform.OS, keyboardHeight, bottomInset: insets.bottom }),
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setShowEdit(false)} />
          <View
            style={{
              backgroundColor: colors.card,
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
                <Icon name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <KeyboardAwareScrollView
              padForKeyboard={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 14, paddingBottom: Math.max(insets.bottom, 8) }}>
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Start time</Text>
                <Pressable
                  onPress={openTimePicker}
                  style={{
                    minHeight: 54,
                    borderRadius: 18,
                    backgroundColor: colors.inset,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Icon name="time-outline" size={18} color={colors.primary} />
                  <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                    {originalStart.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                    {editStart ? formatClockTime(editStart) : ''}
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>Change</Text>
                </Pressable>
                {Platform.OS === 'ios' && showIosTimePicker && editStart ? (
                  <DateTimePicker value={editStart} mode="time" display="spinner" onChange={(_e, picked) => picked && applyPickedTime(picked)} />
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  The day stays the same. Everyone who joined gets notified of a new time.
                </Text>
              </View>
              <FormField
                label="Description"
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="What's the vibe?"
                multiline
                maxLength={PLAN_LIMITS.description}
              />
              <View style={{ backgroundColor: colors.inset, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 10 }}>
                <Icon name="lock-closed-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
                <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, flex: 1 }}>
                  Title, place, group size and day can&apos;t be changed after posting, so people know what they joined. To change
                  those, cancel this plan and create a new one.
                </Text>
              </View>

              {editError ? (
                <Text style={{ color: colors.danger, fontWeight: '700' }}>{editError}</Text>
              ) : null}

              <GradientButton label={isSavingEdit ? 'Saving...' : 'Save changes'} onPress={saveEdit} disabled={isSavingEdit} fullWidth />
            </KeyboardAwareScrollView>
          </View>
        </View>
      ) : null}

      {/* No text fields in here, so a plain <Modal> is fine (see the Edit plan note above). */}
      <Modal visible={showInviteCrew} transparent animationType="slide" onRequestClose={() => setShowInviteCrew(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowInviteCrew(false)} />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
              gap: 16,
              maxHeight: '75%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Invite your crew</Text>
              <Pressable onPress={() => setShowInviteCrew(false)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={{ color: colors.muted, marginTop: -8 }}>They&apos;ll get a notification and can accept or decline.</Text>
            <ScrollView contentContainerStyle={{ gap: 12 }}>
              {getCrewMembers().length ? (
                getCrewMembers().map((member) => {
                  const status = requestStatusFor(member.id);
                  const label =
                    status === 'approved' ? 'Going' : status === 'invited' ? 'Invited' : status === 'pending' ? 'Asked to join' : null;
                  const womenOnlyBlocked = event.womenOnly && member.gender !== 'woman';
                  return (
                    <PersonRow key={member.id} user={member}>
                      {label || womenOnlyBlocked ? (
                        <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 12.5 }}>
                          {label ?? 'Women only'}
                        </Text>
                      ) : (
                        <SolidActionButton
                          label="Invite"
                          icon="add"
                          color={colors.primary}
                          onPress={() => handleInvite(member)}
                          disabled={processingRequestId === member.id}
                        />
                      )}
                    </PersonRow>
                  );
                })
              ) : (
                <Text style={{ color: colors.muted, lineHeight: 21 }}>
                  Your crew is empty. Open someone&apos;s profile and tap Add to my crew; once they accept, you can invite them here.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <SafetyTipsSheet visible={showSafetyTips} onClose={() => setShowSafetyTips(false)} />
    </View>
  );
}
