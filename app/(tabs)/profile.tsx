import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AvatarBubble } from '@/components/AvatarBubble';
import { colors, gradients } from '@/lib/theme';
import { CREDIT_PACKS } from '@/lib/monetisation';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TrustChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string | undefined;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
      }}
    >
      <Ionicons name={icon} size={14} color={colors.skyDark} />
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function ProfileMetric({
  label,
  value,
  variant = 'surface',
}: {
  label: string;
  value: string | number;
  variant?: 'surface' | 'onSurface';
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: variant === 'surface' ? colors.surface : '#FFFFFF',
        borderRadius: 16,
        borderWidth: variant === 'surface' ? 1 : 0,
        borderColor: colors.border,
        paddingVertical: 12,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function ListGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          color: colors.muted,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function ListRow({
  label,
  helper,
  icon,
  onPress,
  isLast,
}: {
  label: string;
  helper?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
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
  const hosting = events.filter(e => e.creatorId === currentUser.id && new Date(e.dateTime) >= now);
  const joined = events.filter(e => e.approvedUserIds.includes(currentUser.id) && e.creatorId !== currentUser.id && new Date(e.dateTime) >= now);
  const past = events.filter(e => (e.creatorId === currentUser.id || e.approvedUserIds.includes(currentUser.id)) && new Date(e.dateTime) < now);

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
                {currentUser.city ?? 'Guwahati'} · @{currentUser.username}
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

        {!currentUser.verified ? (
          <Pressable
            onPress={() => router.push('/verification')}
            style={{
              backgroundColor: '#EFF6FF',
              borderRadius: 24,
              padding: 18,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.skyDark, fontSize: 16, fontWeight: '800' }}>
              Verify to boost trust
            </Text>
            <Text style={{ color: colors.text, lineHeight: 22 }}>
              Verified profiles feel safer to join, stand out better in discovery, and usually get faster approvals from hosts.
            </Text>
          </Pressable>
        ) : null}

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            gap: 14,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
            Trust signals
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <TrustChip
              icon="shield-checkmark-outline"
              label={currentUser.verified ? 'ID verified' : 'Verification pending'}
            />
            <TrustChip
              icon="sparkles-outline"
              label={past.length ? `${past.length} past hangouts` : 'First hangout soon'}
            />
            <TrustChip icon="people-outline" label={`${crew} crew connections`} />
            <TrustChip icon="location-outline" label={currentUser.city ?? 'Guwahati'} />
          </View>
        </View>

        {usage.monetisationEnabled ? (
          <View
            style={{
              backgroundColor: usage.joinLimitReached || usage.createLimitReached ? '#FFF7E8' : colors.surface,
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
              <ProfileMetric variant="onSurface" label="Requests" value={`${usage.joinUsed}/${usage.joinLimit}`} />
              <ProfileMetric variant="onSurface" label="Created" value={`${usage.createUsed}/${usage.createLimit}`} />
              <ProfileMetric variant="onSurface" label="Credits" value={usage.credits} />
            </View>
          </View>
        ) : null}

        {usage.monetisationEnabled ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 }}>
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
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
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

        <ListGroup title="My plans">
          <ListRow
            label="Plans I'm hosting"
            helper={`${hosting.length} upcoming`}
            icon="flag-outline"
            onPress={() => router.push('/profile-plans/hosting')}
          />
          <ListRow
            label="Plans I joined"
            helper={`${joined.length} upcoming`}
            icon="people-outline"
            onPress={() => router.push('/profile-plans/joined')}
          />
          <ListRow
            label="Past plans"
            helper={`${past.length} completed`}
            icon="time-outline"
            onPress={() => router.push('/profile-plans/past')}
            isLast
          />
        </ListGroup>

        <ListGroup title="Account">
          <ListRow
            label="Edit profile & settings"
            helper="Photo, username, bio, app details"
            icon="settings-outline"
            onPress={() => router.push('/settings')}
          />
          <ListRow
            label="My crew"
            helper="People you've built trust with"
            icon="people-circle-outline"
            onPress={() => router.push('/(tabs)/people')}
          />
          <ListRow
            label="Notifications inbox"
            helper="Requests, updates, approvals"
            icon="notifications-outline"
            onPress={() => router.push('/(tabs)/activity')}
            isLast
          />
        </ListGroup>

        <Pressable
          onPress={async () => {
            await logout();
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
