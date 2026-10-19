import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import type * as NotificationsType from 'expo-notifications';
import Constants from 'expo-constants';
import { useTheme, type ThemePreference } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function SettingsRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        gap: 4,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: colors.muted }}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
  const { colors, preference, setPreference } = useTheme();
  const [notificationPermission, setNotificationPermission] = useState<NotificationsType.PermissionStatus | null>(
    null
  );

  useEffect(() => {
    // expo-notifications must not be imported at all in Expo Go on Android — its import-time
    // push-token auto-registration side effect throws there (removed from Expo Go in SDK 53).
    if (Constants.appOwnership === 'expo') {
      return;
    }
    const Notifications: typeof NotificationsType = require('expo-notifications');
    Notifications.getPermissionsAsync().then(({ status }) => setNotificationPermission(status));
  }, []);

  if (!currentUser) {
    return null;
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Settings</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Appearance, notifications, and app details</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Appearance</Text>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              padding: 6,
              flexDirection: 'row',
              gap: 6,
            }}
          >
            {(
              [
                { id: 'light', label: 'Light', icon: 'sunny' },
                { id: 'dark', label: 'Dark', icon: 'moon' },
                { id: 'system', label: 'System', icon: 'phone-portrait' },
              ] as const
            ).map((option) => {
              const active = option.id === preference;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setPreference(option.id as ThemePreference)}
                  style={{
                    flex: 1,
                    backgroundColor: active ? colors.status.info.bg : 'transparent',
                    borderRadius: 15,
                    paddingVertical: 12,
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name={option.icon} size={20} color={active ? colors.primary : colors.muted} />
                  <Text style={{ color: active ? colors.primary : colors.muted, fontWeight: '800', fontSize: 12.5 }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Notifications</Text>
          <Pressable
            onPress={notificationPermission === 'granted' ? undefined : () => Linking.openSettings()}
            disabled={notificationPermission === 'granted'}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon
              name={notificationPermission === 'granted' ? 'notifications-outline' : 'notifications-off-outline'}
              size={20}
              color={notificationPermission === 'granted' ? colors.status.success.text : colors.muted}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                {notificationPermission === 'granted' ? 'Notifications on' : 'Notifications off'}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {notificationPermission === 'granted'
                  ? "You'll get updates for join requests, approvals, and messages."
                  : 'Turn on notifications in system settings to get updates for join requests, approvals, and messages.'}
              </Text>
            </View>
            {notificationPermission !== 'granted' ? <Icon name="chevron-forward" size={16} color={colors.muted} /> : null}
          </Pressable>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>App details</Text>
          <SettingsRow label="Privacy policy" value="Your data and discovery preferences are handled according to Open Plans' privacy rules." />
          <SettingsRow label="Community & safety" value="Women-only visibility, host approvals, and private location unlocks are all part of the safety model." />
          <SettingsRow label="App version" value={appVersion} />
        </View>
      </ScrollView>
    </View>
  );
}
