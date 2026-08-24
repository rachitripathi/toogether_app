import { Platform, Pressable, Text, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Icon } from '@/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '@/providers/AppProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomTabBar({ state, navigation }: any) {
  const { currentUser, requests, events } = useApp();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const fadeGradientColors: [string, string] =
    scheme === 'dark' ? ['rgba(11,13,20,0)', 'rgba(11,13,20,0.92)'] : ['rgba(255,255,255,0)', 'rgba(246,247,251,0.9)'];
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
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        paddingHorizontal: 18,
        paddingBottom: Math.max(insets.bottom, 12),
        justifyContent: 'flex-end',
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={fadeGradientColors}
        locations={[0, 0.85]}
        style={{
          position: 'absolute',
          top: -60,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 34,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 10,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          ...Platform.select({
            ios: {
              shadowColor: scheme === 'dark' ? '#000000' : '#5D6B99',
              shadowOpacity: 0.3,
              shadowRadius: 26,
              shadowOffset: { width: 0, height: 14 },
            },
            android: {
              elevation: 14,
            },
          }),
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
                backgroundColor: isActive ? colors.status.info.bg : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isActive ? 6 : 0,
              }}
            >
              <View>
                <Icon
                  name={iconName}
                  size={20}
                  color={isActive ? colors.primary : colors.muted}
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

      {currentRoute === 'home' ? (
        <View
          style={{
            position: 'absolute',
            right: 20,
            bottom: Math.max(insets.bottom, 12) + 84,
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: colors.primary,
            ...Platform.select({
              ios: {
                shadowColor: scheme === 'dark' ? '#000000' : '#3355DD',
                shadowOpacity: 0.5,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
              },
              android: {
                elevation: 10,
              },
            }),
          }}
        >
          <Pressable
            onPress={() => router.push('/create-event')}
            style={{ flex: 1, borderRadius: 29, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#7B96FF', colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 29,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            >
              <Icon name="add" size={26} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
