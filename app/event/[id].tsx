import { useLocalSearchParams, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '@/components/GradientButton';
import { AvatarBubble } from '@/components/AvatarBubble';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentUser,
    getEventById,
    getUserById,
    requestToJoin,
    getRequestStatus,
    approveRequest,
    rejectRequest,
    requests,
    categoryConfig,
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
  const date = new Date(event.dateTime);
  const canViewWomenOnly = !event.womenOnly || currentUser?.gender === 'woman' || isCreator;

  if (!canViewWomenOnly) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page, padding: 24 }}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>
          Women-only plan
        </Text>
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 8 }}>
          This plan is only visible to women participants.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          backgroundColor: config.iconBackground,
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 24,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          gap: 18,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          {(isCreator || requestStatus === 'approved') ? (
            <Pressable
              onPress={() => router.push(`/chat/${event.id}`)}
              style={{ backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <Text style={{ color: colors.primary, fontWeight: '800' }}>Open Chat</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 54 }}>{event.emoji}</Text>
          <View style={{ flex: 1, gap: 8 }}>
            <View
              style={{ alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', gap: 6 }}
            >
              <Text style={{ color: config.chipText, fontSize: 12, fontWeight: '700' }}>{config.label}</Text>
              {event.womenOnly ? (
                <Text style={{ color: '#BE185D', fontSize: 12, fontWeight: '700' }}>Women only</Text>
              ) : null}
            </View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>{event.title}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 140 }}>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
              {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="location-outline" size={20} color={colors.secondary} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>{event.location}</Text>
          </View>
          {event.maxPeople ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="people-outline" size={20} color="#16A34A" />
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {event.approvedUserIds.length + 1} / {event.maxPeople} people
              </Text>
            </View>
          ) : null}
        </View>

        {event.description ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>About</Text>
            <Text style={{ color: colors.muted, lineHeight: 22 }}>{event.description}</Text>
          </View>
        ) : null}

        {creator ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Hosted by</Text>
            <Pressable onPress={() => router.push(`/user/${creator.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AvatarBubble user={creator} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{creator.name}</Text>
                <Text style={{ color: colors.muted }}>@{creator.username}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
            </Pressable>
          </View>
        ) : null}

        {event.approvedUserIds.length ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
              Going ({event.approvedUserIds.length})
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {event.approvedUserIds.map((userId) => {
                const user = getUserById(userId);
                if (!user) return null;
                return (
                  <Pressable
                    key={userId}
                    onPress={() => router.push(`/user/${userId}`)}
                    style={{ backgroundColor: colors.page, borderRadius: 999, padding: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <AvatarBubble user={user} size={28} />
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{user.name.split(' ')[0]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {isCreator ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
              Join Requests {pendingRequests.length ? `(${pendingRequests.length})` : ''}
            </Text>
            {pendingRequests.length ? (
              pendingRequests.map((request) => {
                const user = getUserById(request.userId);
                if (!user) return null;
                return (
                  <View key={request.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <AvatarBubble user={user} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>{user.name}</Text>
                      <Text style={{ color: colors.muted }}>@{user.username}</Text>
                    </View>
                    <Pressable
                      onPress={() => rejectRequest(event.id, user.id)}
                      style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFE4E6', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="close" size={18} color={colors.danger} />
                    </Pressable>
                    <Pressable
                      onPress={() => approveRequest(event.id, user.id)}
                      style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}
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
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 16) + 12 }}>
          {requestStatus === 'approved' ? (
            <GradientButton label="Open Chat" onPress={() => router.push(`/chat/${event.id}`)} fullWidth />
          ) : requestStatus === 'pending' ? (
            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 24, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#B45309', fontWeight: '800' }}>Request Pending</Text>
            </View>
          ) : requestStatus === 'rejected' ? (
            <View style={{ backgroundColor: '#E5E7EB', borderRadius: 24, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontWeight: '800' }}>Not this time</Text>
            </View>
          ) : (
            <GradientButton label="Request to Join" onPress={() => requestToJoin(event.id)} fullWidth />
          )}
        </View>
      ) : null}
    </View>
  );
}
