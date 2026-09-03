import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { AvatarBubble } from '@/components/AvatarBubble';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatMessageTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, getEventById, getUserById, getRequestStatus, messages, sendMessage, refreshEventMessages } =
    useApp();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const event = getEventById(id ?? '');

  useEffect(() => {
    if (event?.id) {
      refreshEventMessages(event.id);
    }
  }, [event?.id]);

  // Driving the composer's bottom padding from real keyboard-height events instead of
  // KeyboardAvoidingView: that component's own dynamic padding compounds with this
  // screen's safe-area padding (double bottom spacing while the keyboard is up), and its
  // internal padding can fail to fully reset to 0 after the keyboard closes, leaving a
  // stray gap at rest. Listening directly guarantees the padding matches reality.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (!event) {
    return null;
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
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
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
        </View>
      </View>

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
                      borderWidth: 1,
                      borderColor: isMe ? colors.primary : colors.border,
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
              borderWidth: 1,
              borderColor: colors.border,
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
          // Android's root view already resizes to exclude the keyboard (Expo's default
          // windowSoftInputMode is "resize"), so the composer is already flush above it
          // with no help needed — adding keyboardHeight here too would double it up. iOS
          // never resizes the screen for the keyboard (it's an overlay), so it still
          // needs the manual boost while the keyboard is visible.
          paddingBottom:
            Platform.OS === 'ios' && keyboardHeight > 0 ? keyboardHeight + 12 : Math.max(insets.bottom, 16) + 12,
          paddingTop: 10,
        }}
      >
        {!canChat ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
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
                backgroundColor: colors.surface,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
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
    </View>
  );
}
