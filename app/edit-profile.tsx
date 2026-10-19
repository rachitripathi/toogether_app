import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '@/components/Icon';
import { AvatarBubble } from '@/components/AvatarBubble';
import { FormField } from '@/components/FormField';
import { CityPickerField } from '@/components/CityPickerField';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { PROFILE_LIMITS, cleanLine, validateName } from '@/lib/profileFields';
import { UsernameStatusIcon, usernameStatusMessage } from '@/components/UsernameStatusIcon';
import { useTheme } from '@/providers/ThemeProvider';
import { deleteCurrentAvatar, uploadAvatar } from '@/lib/cloudinary';
import { normalizeUsername, useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Presented as a modal sheet (app/_layout.tsx). Opened from the pencil button / avatar in the
// Profile tab header. Text fields save together via the header's Save; the photo saves as soon
// as it's picked or removed, same as before this was split out of Settings.
export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, updateCurrentUser } = useApp();
  const { colors, shadow } = useTheme();
  // Seeded once from the profile; not kept in sync afterwards, so a photo upload (which updates
  // currentUser) can't wipe text that's mid-edit.
  const [name, setName] = useState(currentUser?.name ?? '');
  const [username, setUsername] = useState(currentUser?.username ?? '');
  const usernameStatus = useUsernameAvailability(username, currentUser?.username);
  const [city, setCity] = useState(currentUser?.city ?? '');
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [nameError, setNameError] = useState('');

  if (!currentUser) {
    return null;
  }

  const isDirty =
    cleanLine(name) !== currentUser.name ||
    normalizeUsername(username) !== normalizeUsername(currentUser.username) ||
    city !== (currentUser.city ?? '');

  const close = () => {
    if (!isDirty) {
      router.back();
      return;
    }
    Alert.alert('Discard changes?', "Your edits to your profile won't be saved.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

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
      await updateCurrentUser({ avatarUri: url });
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
            await updateCurrentUser({ avatarUri: '' });
          } catch (error) {
            Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
          } finally {
            setIsUpdatingPhoto(false);
          }
        },
      },
    ]);
  };

  const saveProfile = async () => {
    const normalizedUsername = normalizeUsername(username);

    // Blank or whitespace-only names used to silently fall back to the old name.
    const nameProblem = validateName(name);
    setNameError(nameProblem);
    if (nameProblem) {
      return;
    }
    if (!normalizedUsername) {
      Alert.alert('Username needed', "Your username can't be blank.");
      return;
    }

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

    try {
      await updateCurrentUser({
        name: cleanLine(name),
        username: normalizedUsername,
        city,
      });
      router.back();
    } catch (error) {
      Alert.alert("Couldn't save", error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {/* Block swipe-to-dismiss while there are unsaved edits so they can't be lost by accident. */}
      <Stack.Screen options={{ gestureEnabled: !isDirty }} />
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.card,
        }}
      >
        <Pressable onPress={close} hitSlop={10} style={{ minWidth: 64 }}>
          <Text style={{ color: colors.muted, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text }}>Edit profile</Text>
        <Pressable onPress={saveProfile} disabled={!isDirty} hitSlop={10} style={{ minWidth: 64, alignItems: 'flex-end' }}>
          <Text style={{ color: isDirty ? colors.primary : colors.muted, fontSize: 15, fontWeight: '900', opacity: isDirty ? 1 : 0.5 }}>
            Save
          </Text>
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
      >
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Pressable onPress={pickImage} disabled={isUpdatingPhoto} style={{ position: 'relative', ...shadow.card }}>
            <AvatarBubble user={currentUser} size={104} />
            {isUpdatingPhoto ? (
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 52,
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
                  right: 0,
                  bottom: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.primary,
                  borderWidth: 3,
                  borderColor: colors.page,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="camera-outline" size={16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <Pressable onPress={pickImage} disabled={isUpdatingPhoto} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
                {currentUser.avatarUri ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>
            {currentUser.avatarUri ? (
              <Pressable onPress={removePhoto} disabled={isUpdatingPhoto} hitSlop={8}>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 28,
            padding: 18,
            gap: 16,
            ...shadow.card,
          }}
        >
          <FormField
            label="Name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError('');
            }}
            placeholder="Your name"
            maxLength={PROFILE_LIMITS.name}
            error={nameError}
          />
          <FormField
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            autoCapitalize="none"
            rightAccessory={<UsernameStatusIcon status={usernameStatus} />}
            {...usernameStatusMessage(usernameStatus, normalizeUsername(username))}
          />
          <CityPickerField value={city} onChange={setCity} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
