import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { AvatarBubble } from '@/components/AvatarBubble';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, getEventById, getUserById, getRequestStatus, messages, sendMessage } = useApp();
  const [text, setText] = useState('');
  const event = getEventById(id ?? '');

  if (!event) {
    return null;
  }

  const isCreator = currentUser?.id === event.creatorId;
  const canChat = isCreator || getRequestStatus(event.id) === 'approved';
  const eventMessages = messages[event.id] ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
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

      {!canChat ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
          <Ionicons name="lock-closed-outline" size={36} color="#98A2B3" />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Chat locked</Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>Get approved for the event to join the conversation.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 20 }}>
            {eventMessages.map((message) => {
              const user = getUserById(message.userId);
              const isMe = message.userId === currentUser?.id;
              return (
                <View
                  key={message.id}
                  style={{ flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 10 }}
                >
                  {!isMe && user ? <AvatarBubble user={user} size={28} /> : <View style={{ width: 28 }} />}
                  <View style={{ maxWidth: '78%', gap: 4 }}>
                    {!isMe && user ? (
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                        {user.name.split(' ')[0]}
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
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 12, paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 16 }}>
              <TextInput
                value={text}
                onChangeText={setText}
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
          </View>
        </>
      )}
    </View>
  );
}
