import { useLocalSearchParams, router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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

function formatPublicSchedule(value: string, slot: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} • ${slot}`;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, getEventById, getUserById, getRequestStatus, messages, sendMessage } = useApp();
  const [text, setText] = useState('');
  const event = getEventById(id ?? '');

  const host = useMemo(() => (event ? getUserById(event.creatorId) : undefined), [event, getUserById]);

  if (!event) {
    return null;
  }

  const isCreator = currentUser?.id === event.creatorId;
  const canChat = isCreator || getRequestStatus(event.id) === 'approved';
  const eventMessages = messages[event.id] ?? [];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Math.max(insets.top, 12)}
      style={{ flex: 1, backgroundColor: colors.page }}
    >
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 20,
          gap: 16,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{event.emoji} Event Chat</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{event.title}</Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#F8FBFF',
            borderRadius: 22,
            borderWidth: 1,
            borderColor: '#D9ECFF',
            padding: 16,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="globe-outline" size={16} color={colors.skyDark} />
            <Text style={{ color: colors.skyDark, fontSize: 12, fontWeight: '800' }}>Public plan details</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: '800' }}>{event.area}, Guwahati</Text>
          <Text style={{ color: colors.muted }}>{formatPublicSchedule(event.dateTime, event.timeSlot)}</Text>
          {host ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AvatarBubble user={host} size={26} />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Hosted by {host.name.split(' ')[0]}, {host.age}
                {host.verified ? ' • Verified' : ''}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: canChat ? '#FFF7E8' : '#F4F6F8',
            borderRadius: 22,
            padding: 16,
            gap: 6,
          }}
        >
          <Text style={{ color: canChat ? '#C26A00' : colors.muted, fontSize: 12, fontWeight: '800' }}>
            {canChat ? 'Private details unlocked' : 'Private details locked'}
          </Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {canChat
              ? `${event.exactTime} • ${event.exactLocation}`
              : 'Exact time and address unlock after your join request is approved.'}
          </Text>
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
                {!isMe && user ? <AvatarBubble user={user} size={30} /> : <View style={{ width: 24 }} />}
                <View style={{ maxWidth: '86%', gap: 4 }}>
                  {!isMe && user ? (
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                      {user.name.split(' ')[0]}, {user.age}
                      {user.verified ? ' • Verified' : ''}
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
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 11,
                      textAlign: isMe ? 'right' : 'left',
                    }}
                  >
                    {formatMessageTime(message.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 24, gap: 8 }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 16 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
              placeholder="Say something..."
              placeholderTextColor="#98A2B3"
              style={{ flex: 1, minHeight: 52, color: colors.text }}
            />
            <Pressable
              onPress={() => {
                sendMessage(event.id, text);
                setText('');
              }}
              disabled={!text.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: text.trim() ? colors.primary : '#D0D5DD',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="send" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
