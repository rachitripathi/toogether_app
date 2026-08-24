import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { AvatarBubble } from '@/components/AvatarBubble';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { UsernameStatusIcon, usernameStatusMessage } from '@/components/UsernameStatusIcon';
import { useTheme, type ThemePreference } from '@/providers/ThemeProvider';
import { deleteCurrentAvatar, uploadAvatar } from '@/lib/cloudinary';
import { normalizeUsername, useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function SettingsRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
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
  const { currentUser, updateCurrentUser } = useApp();
  const { colors, shadow, preference, setPreference } = useTheme();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const usernameStatus = useUsernameAvailability(username, currentUser?.username);
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    setName(currentUser.name);
    setUsername(currentUser.username);
    setBio(currentUser.bio ?? '');
    setCity(currentUser.city ?? '');
  }, [currentUser]);

  if (!currentUser) {
    return null;
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const pickImage = async () => {
    let result: ImagePicker.ImagePickerResult;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo access to update your profile picture.');
        return;
      }

      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    } catch (error) {
      Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
      return;
    }

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    setIsUpdatingPhoto(true);
    try {
      const url = await uploadAvatar(result.assets[0].uri);
      // Old asset is looked up server-side from the profile row, so this must run
      // before updateCurrentUser overwrites avatar_uri with the new one.
      await deleteCurrentAvatar();
      updateCurrentUser({ avatarUri: url });
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  const removePhoto = () => {
    Alert.alert('Remove profile photo?', 'You can add a new one anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setIsUpdatingPhoto(true);
          try {
            await deleteCurrentAvatar();
            updateCurrentUser({ avatarUri: '' });
          } catch (error) {
            Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
          } finally {
            setIsUpdatingPhoto(false);
          }
        },
      },
    ]);
  };

  const saveProfile = () => {
    const normalizedUsername = normalizeUsername(username);

    if (normalizedUsername && normalizedUsername !== normalizeUsername(currentUser.username)) {
      if (usernameStatus === 'invalid') {
        Alert.alert('Invalid username', '3-20 characters: letters, numbers, and underscores only.');
        return;
      }
      if (usernameStatus === 'checking') {
        Alert.alert('Still checking', 'Give it a second to finish checking that username.');
        return;
      }
      if (usernameStatus === 'taken') {
        Alert.alert('Username taken', 'That username is already taken — pick another one.');
        return;
      }
    }

    updateCurrentUser({
      name: name.trim() || currentUser.name,
      username: normalizedUsername || currentUser.username,
      bio: bio.trim(),
      city: city.trim() || currentUser.city,
    });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
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
          <Text style={{ color: colors.muted, fontSize: 12 }}>Profile, account, and app details</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            gap: 16,
            ...shadow.card,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Edit profile</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable onPress={pickImage} disabled={isUpdatingPhoto} style={{ position: 'relative' }}>
              <AvatarBubble user={currentUser} size={76} />
              {isUpdatingPhoto ? (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 38,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    borderWidth: 3,
                    borderColor: colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="camera-outline" size={14} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Profile photo</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Tap the avatar to choose a new picture from your phone.
              </Text>
              {currentUser.avatarUri ? (
                <Pressable onPress={removePhoto} disabled={isUpdatingPhoto} hitSlop={8}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Remove photo</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <FormField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <FormField
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            autoCapitalize="none"
            rightAccessory={<UsernameStatusIcon status={usernameStatus} />}
            {...usernameStatusMessage(usernameStatus, normalizeUsername(username))}
          />
          <FormField label="City" value={city} onChangeText={setCity} placeholder="City" />
          <FormField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people a little about yourself"
            multiline
          />

          <GradientButton label="Save changes" onPress={saveProfile} fullWidth />
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Appearance</Text>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
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
                    borderWidth: 1,
                    borderColor: active ? colors.primary : 'transparent',
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
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>App details</Text>
          <SettingsRow label="Privacy policy" value="Your data and discovery preferences are handled according to Toogether's privacy rules." />
          <SettingsRow label="Community & safety" value="Women-only visibility, host approvals, and private location unlocks are all part of the safety model." />
          <SettingsRow label="App version" value={appVersion} />
        </View>
      </ScrollView>
    </View>
  );
}
