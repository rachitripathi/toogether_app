import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { AvatarBubble } from '@/components/AvatarBubble';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { colors, shadow } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function SettingsRow({ label, value }: { label: string; value: string }) {
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
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    setName(currentUser.name);
    setUsername(currentUser.username);
    setBio(currentUser.bio ?? '');
    setCity(currentUser.city);
  }, [currentUser]);

  if (!currentUser) {
    return null;
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to update your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      updateCurrentUser({ avatarUri: result.assets[0].uri });
    }
  };

  const saveProfile = () => {
    updateCurrentUser({
      name: name.trim() || currentUser.name,
      username: username.trim().replace(/\s+/g, '').toLowerCase() || currentUser.username,
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
          backgroundColor: '#FFFFFF',
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
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Settings</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Profile, account, and app details</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
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
            <Pressable onPress={pickImage} style={{ position: 'relative' }}>
              <AvatarBubble user={currentUser} size={76} />
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
                  borderColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
              </View>
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Profile photo</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Tap the avatar to choose a new picture from your phone.
              </Text>
            </View>
          </View>

          <FormField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <FormField label="Username" value={username} onChangeText={setUsername} placeholder="username" />
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
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>App details</Text>
          <SettingsRow label="Privacy policy" value="Your data and discovery preferences are handled according to Toogether's privacy rules." />
          <SettingsRow label="Community & safety" value="Women-only visibility, host approvals, and private location unlocks are all part of the safety model." />
          <SettingsRow label="App version" value={appVersion} />
        </View>
      </ScrollView>
    </View>
  );
}
