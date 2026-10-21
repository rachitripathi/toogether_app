import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { dismissChatPushes, setActiveChatEventId, useNotifications } from '@/providers/NotificationsProvider';
import { AvatarBubble } from '@/components/AvatarBubble';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { SafetyTipsSheet } from '@/components/SafetyTipsSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardOverlap } from '@/hooks/useKeyboardHeight';
import { PlanClosedScreen } from '@/components/PlanClosedScreen';
import { isEventArchived } from '@/lib/eventTime';

function formatMessageTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, getEventById, getUserById, getRequestStatus, messages, sendMessage, refreshEventMessages, isLoadingEvents } =
    useApp();
  const { colors } = useTheme();
  const { getUnreadChatCount, markChatRead } = useNotifications();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showSafetyBanner, setShowSafetyBanner] = useState(true);
  const [showSafetyTips, setShowSafetyTips] = useState(false);
  const event = getEventById(id ?? '');

  useEffect(() => {
    if (event?.id) {
      refreshEventMessages(event.id);
    }
  }, [event?.id]);

  const eventId = event?.id;

  // Suppresses the foreground push banner for this chat only while it's the focused screen.
  useFocusEffect(
    useCallback(() => {
      if (!eventId) return;
      setActiveChatEventId(eventId);
      dismissChatPushes(eventId);
      return () => setActiveChatEventId(null);
    }, [eventId])
  );

  // Being on this screen counts as reading its messages, including ones that arrive while open.
  const hasUnreadChat = !!eventId && getUnreadChatCount(eventId) > 0;
  useEffect(() => {
    if (eventId && hasUnreadChat) {
      markChatRead(eventId);
    }
  }, [eventId, hasUnreadChat]);

  // Driving the composer's bottom padding from keyboard events instead of KeyboardAvoidingView:
  // that component's own dynamic padding compounds with this screen's safe-area padding, and
  // can fail to reset to 0 after the keyboard closes. The overlap is measured against this
  // screen's root view, so if the OS already resized the window for the keyboard we don't
  // lift by the keyboard height a second time (that's what parked the composer mid-screen).
  const { ref: keyboardOverlapRef, onLayout: onKeyboardOverlapLayout, keyboardVisible, overlap: keyboardOverlap } = useKeyboardOverlap(() => scrollRef.current?.scrollToEnd({ animated: true }));

  if (!event) {
    // Still loading (e.g. opened from a push on a cold start): render nothing yet. Otherwise the
    // plan isn't visible to this user anymore (cancelled, or archived and they weren't in it).
    return isLoadingEvents ? null : <PlanClosedScreen />;
  }

  // The chat closes 6h after the plan starts (migration 016's messages RLS). Messages already
  // loaded into memory aren't shown either.
  if (isEventArchived(event)) {
    return <PlanClosedScreen event={event} />;
  }

  const isCreator = currentUser?.id === event.creatorId;
  const canChat = isCreator || getRequestStatus(event.id) === 'approved';
  const eventMessages = messages[event.id] ?? [];

  const handleSend = async () => {
    const value = text.trim();
    if (!value || isSending) {
      return;
    }
    setSendError(null);
    setIsSending(true);
    setText('');
    try {
      await sendMessage(event.id, value);
    } catch (err) {
      setText(value);
      setSendError(err instanceof Error ? err.message : 'Could not send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View ref={keyboardOverlapRef} onLayout={onKeyboardOverlapLayout} style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.page,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="arrow-back" size={18} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => router.push(`/event/${event.id}`)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }}
          >
            <Text style={{ fontSize: 26 }}>{event.emoji}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>
                {event.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
                {event.approvedUserIds.length + 1} member{event.approvedUserIds.length + 1 !== 1 ? 's' : ''} · Tap to view event
              </Text>
            </View>
          </Pressable>

          {canChat ? (
            // Members list: see who's in, report someone, and (host) manage members.
            <Pressable
              onPress={() => router.push(`/event-members/${event.id}`)}
              hitSlop={6}
              accessibilityLabel="Members"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.page,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="people-outline" size={19} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {canChat && showSafetyBanner ? (
        <Pressable
          onPress={() => setShowSafetyTips(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginHorizontal: 16,
            marginTop: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 16,
            backgroundColor: colors.status.info.bg,
          }}
        >
          <Icon name="shield-checkmark-outline" size={16} color={colors.status.info.text} />
          <Text style={{ flex: 1, color: colors.status.info.text, fontSize: 12, fontWeight: '700' }}>
            Meeting up? Keep it public and don't share personal info here — tap for tips
          </Text>
          <Pressable hitSlop={8} onPress={() => setShowSafetyBanner(false)}>
            <Icon name="close" size={16} color={colors.status.info.text} />
          </Pressable>
        </Pressable>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
      >
        {eventMessages.length ? (
          eventMessages.map((message) => {
            const user = getUserById(message.userId);
            const isMe = message.userId === currentUser?.id;
            return (
              <View
                key={message.id}
                style={{ flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}
              >
                {user ? <AvatarBubble user={user} size={30} /> : <View style={{ width: 30 }} />}
                <View style={{ maxWidth: '80%', gap: 4 }}>
                  {!isMe && user ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                        {user.name.split(' ')[0]}, {user.age}
                      </Text>
                      {user.verified ? <VerifiedBadge size={11} /> : null}
                    </View>
                  ) : null}
                  <View
                    style={{
                      backgroundColor: isMe ? colors.primary : colors.surface,
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomRightRadius: isMe ? 6 : 18,
                      borderBottomLeftRadius: isMe ? 18 : 6,
                    }}
                  >
                    <Text style={{ color: isMe ? '#FFFFFF' : colors.text, lineHeight: 20 }}>{message.text}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11, textAlign: isMe ? 'right' : 'left' }}>
                    {formatMessageTime(message.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              padding: 24,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>No messages yet</Text>
            <Text style={{ color: colors.muted }}>
              {canChat
                ? 'Break the ice and coordinate the plan here.'
                : 'Once approved, you will be able to join the conversation here.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 16,
          // With the keyboard up it covers the home indicator / nav bar, so the resting
          // safe-area padding is replaced by the measured overlap rather than added to it.
          // Growing this padding shrinks the flex:1 ScrollView above by the same amount,
          // so the messages stay visible rather than sliding under the keyboard.
          paddingBottom: (keyboardVisible ? keyboardOverlap : Math.max(insets.bottom, 16)) + 12,
          paddingTop: 10,
        }}
      >
        {!canChat ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon name="lock-closed-outline" size={18} color={colors.muted} />
            <Text style={{ flex: 1, color: colors.muted }}>
              Chat opens automatically after the host approves your request.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {sendError ? <Text style={{ color: colors.danger, fontSize: 13 }}>{sendError}</Text> : null}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: colors.inset,
                borderRadius: 999,
                paddingHorizontal: 16,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                placeholder="Say something..."
                placeholderTextColor={colors.muted}
                editable={!isSending}
                style={{ flex: 1, minHeight: 52, color: colors.text }}
              />
              <Pressable
                onPress={handleSend}
                disabled={!text.trim() || isSending}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: text.trim() && !isSending ? colors.primary : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="send" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <SafetyTipsSheet visible={showSafetyTips} onClose={() => setShowSafetyTips(false)} />
    </View>
  );
}
