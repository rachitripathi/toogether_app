import { useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AvatarBubble } from '@/components/AvatarBubble';
import { colors, gradients } from '@/lib/theme';
import { CREDIT_PACKS } from '@/lib/monetisation';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function ProfileMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 12,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function RowLink({
  label,
  helper,
  icon,
  onPress,
}: {
  label: string;
  helper?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>{label}</Text>
        {helper ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{helper}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { currentUser, events, logout, getUserAverageRating, getCrewMembers, getUsageSummary, buyCreditPack } = useApp();

  if (!currentUser) {
    return <Redirect href="/auth" />;
  }

  const now = new Date();
  const hosting = events.filter((event) => event.creatorId === currentUser.id && new Date(event.dateTime) >= now);
  const past = events.filter((event) => event.creatorId === currentUser.id && new Date(event.dateTime) < now);
  const joined = events.filter(
    (event) => event.approvedUserIds.includes(currentUser.id) && event.creatorId !== currentUser.id
  );
  const rating = getUserAverageRating(currentUser.id);
  const crew = getCrewMembers().length;
  const totalPlans = hosting.length + joined.length + past.length;
  const usage = getUsageSummary();

  const subtitleOpacity = scrollY.interpolate({
    inputRange: [0, 55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerPaddingBottom = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [22, 10],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <LinearGradient colors={[...gradients.profile]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Animated.View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: headerPaddingBottom }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable onPress={() => router.push('/settings')}>
              <AvatarBubble user={currentUser} size={52} />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.3 }}>
                {currentUser.name.split(' ')[0]}, {currentUser.age}
              </Text>
              <Animated.Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, opacity: subtitleOpacity }}>
                {currentUser.city} · @{currentUser.username}
              </Animated.Text>
            </View>
            <Pressable
              onPress={() => router.push('/settings')}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 110 }}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ProfileMetric label="Plans" value={totalPlans} />
          <ProfileMetric label="Crew" value={crew} />
          <ProfileMetric label="Karma" value={rating ? rating.toFixed(1) : 'New'} />
        </View>

        {usage.monetisationEnabled ? (
          <View
            style={{
              backgroundColor: usage.joinLimitReached || usage.createLimitReached ? '#FFF7E8' : '#FFFFFF',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: usage.joinLimitReached || usage.createLimitReached ? '#FDE7B3' : colors.border,
              padding: 18,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="flash-outline" size={18} color={usage.joinLimitReached ? '#B45309' : colors.primary} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>This month</Text>
              <Text style={{ marginLeft: 'auto', color: colors.muted, fontSize: 12, fontWeight: '800' }}>
                Credits ON
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ProfileMetric label="Requests" value={`${usage.joinUsed}/${usage.joinLimit}`} />
              <ProfileMetric label="Created" value={`${usage.createUsed}/${usage.createLimit}`} />
              <ProfileMetric label="Credits" value={usage.credits} />
            </View>
          </View>
        ) : null}

        {usage.monetisationEnabled ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flash" size={20} color={colors.skyDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>Remaining credits</Text>
                <Text style={{ color: colors.muted }}>{usage.credits} available</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>{usage.credits}</Text>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Buy more</Text>
              {CREDIT_PACKS.map((pack) => (
                <Pressable
                  key={pack.id}
                  onPress={() => buyCreditPack(pack.id)}
                  style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '900' }}>{pack.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{pack.credits} credits</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>Rs {pack.price}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>My plans</Text>
          <RowLink
            label="Plans I'm hosting"
            helper={`${hosting.length} active plans`}
            icon="calendar-outline"
            onPress={() => router.push({ pathname: '/profile-plans/[section]', params: { section: 'hosting' } })}
          />
          <RowLink
            label="Plans I joined"
            helper={`${joined.length} plans joined`}
            icon="people-outline"
            onPress={() => router.push({ pathname: '/profile-plans/[section]', params: { section: 'joined' } })}
          />
          <RowLink
            label="Past plans"
            helper={`${past.length} completed plans`}
            icon="time-outline"
            onPress={() => router.push({ pathname: '/profile-plans/[section]', params: { section: 'past' } })}
          />
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Account</Text>
          <RowLink
            label="Edit profile & settings"
            helper="Photo, username, bio, app details"
            icon="settings-outline"
            onPress={() => router.push('/settings')}
          />
          <RowLink
            label="My crew"
            helper="People you've built trust with"
            icon="people-circle-outline"
            onPress={() => router.push('/(tabs)/people')}
          />
          <RowLink
            label="Notifications inbox"
            helper="Requests, updates, approvals"
            icon="notifications-outline"
            onPress={() => router.push('/(tabs)/activity')}
          />
        </View>

        <Pressable
          onPress={() => {
            logout();
            router.replace('/auth');
          }}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: '#FFE4E6',
            padding: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: '800' }}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
