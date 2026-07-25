import { useLocalSearchParams, router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { AvatarBubble } from '@/components/AvatarBubble';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatMessageTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, getEventById, getUserById, getRequestStatus, messages, sendMessage } = useApp();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const event = getEventById(id ?? '');

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Math.max(insets.top, 12)}
      style={{ flex: 1, backgroundColor: colors.page }}
    >
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: '#FFFFFF',
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
            <Ionicons name="arrow-back" size={18} color={colors.text} />
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
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                      {user.name.split(' ')[0]}, {user.age}
                      {user.verified ? ' · Verified' : ''}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      backgroundColor: isMe ? colors.primary : '#FFFFFF',
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomRightRadius: isMe ? 6 : 18,
                      borderBottomLeftRadius: isMe ? 18 : 6,
                      borderWidth: isMe ? 0 : 1,
                      borderColor: colors.border,
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
              backgroundColor: '#FFFFFF',
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

      <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) + 12, paddingTop: 10 }}>
        {!canChat ? (
          <View
            style={{
              backgroundColor: '#FFFFFF',
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
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
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
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 999,
                paddingHorizontal: 16,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                placeholder="Say something..."
                placeholderTextColor="#98A2B3"
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
                  backgroundColor: text.trim() && !isSending ? colors.primary : '#D0D5DD',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
