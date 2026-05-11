import { Pressable, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '@/providers/AppProvider';
import { colors, shadow } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomTabBar({ state, navigation }: any) {
  const { currentUser, requests, events } = useApp();
  const insets = useSafeAreaInsets();
  const pendingCount = requests.filter((request) => {
    const event = events.find((item) => item.id === request.eventId);
    return request.status === 'pending' && event?.creatorId === currentUser?.id;
  }).length;

  const items = [
    { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { key: 'people', label: 'People', icon: 'people-outline', activeIcon: 'people' },
    { key: 'activity', label: 'Activity', icon: 'notifications-outline', activeIcon: 'notifications' },
    { key: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ] as const;

  const currentRoute = state.routes[state.index]?.name;

  return (
    <View
      style={{
        backgroundColor: 'transparent',
        paddingHorizontal: 18,
        paddingBottom: Math.max(insets.bottom, 12),
        minHeight: 92 + insets.bottom,
        justifyContent: 'flex-end',
      }}
    >
      <LinearGradient
        colors={['rgba(244,247,246,0)', 'rgba(244,247,246,0.92)', colors.page]}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -14,
          height: 24,
        }}
      />

      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 34,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 10,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          ...shadow.lift,
        }}
      >
        {items.map((item) => {
          const isActive = item.key === currentRoute;
          const iconName = isActive ? item.activeIcon : item.icon;

          return (
            <Pressable
              key={item.key}
              onPress={() => {
                navigation.navigate(item.key);
              }}
              style={{
                flex: isActive ? 1.35 : 1,
                minHeight: 48,
                borderRadius: 24,
                backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isActive ? 6 : 0,
              }}
            >
              <View>
                <Ionicons
                  name={iconName}
                  size={20}
                  color={isActive ? colors.primary : '#8C95A6'}
                />
                {item.key === 'activity' && pendingCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -3,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.danger,
                    }}
                  />
                ) : null}
              </View>
              {isActive ? (
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>{item.label}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
