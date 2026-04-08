import { Pressable, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/providers/AppProvider';
import { colors } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { currentUser, requests, events } = useApp();
  const insets = useSafeAreaInsets();
  const pendingCount = requests.filter((request) => {
    const event = events.find((item) => item.id === request.eventId);
    return request.status === 'pending' && event?.creatorId === currentUser?.id;
  }).length;

  const renderTab = (route: any, index: number) => {
    const isFocused = state.index === index;
    const options = descriptors[route.key].options;
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      home: 'home',
      people: 'people',
      activity: 'notifications',
      profile: 'person',
    };
    const iconName = iconMap[route.name] ?? 'ellipse';
    const label = options.title ?? route.name;
    const badge = route.name === 'activity' ? pendingCount : 0;

    return (
      <Pressable
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        style={{ flex: 1, alignItems: 'center', gap: 4 }}
      >
        <View>
          <Ionicons
            name={iconName}
            size={22}
            color={isFocused ? colors.primary : '#98A2B3'}
          />
          {badge > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -6,
                right: -10,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: isFocused ? colors.primary : '#98A2B3', fontSize: 11, fontWeight: '700' }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 12,
        paddingTop: 14,
        paddingBottom: Math.max(insets.bottom, 14),
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 92 + insets.bottom,
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {leftRoutes.map((route: any, index: number) => renderTab(route, index))}
      </View>

      <View style={{ width: 76 }} />

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {rightRoutes.map((route: any, index: number) => renderTab(route, index + 2))}
      </View>

      <Pressable
        onPress={() => router.push('/create-event')}
        style={{
          position: 'absolute',
          alignSelf: 'center',
          bottom: Math.max(insets.bottom, 14) + 18,
          left: '50%',
          marginLeft: -31,
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: '#FFFFFF',
          shadowColor: colors.primary,
          shadowOpacity: 0.22,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>
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
