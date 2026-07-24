import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getAgeFromDob(value: string) {
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age;
}

function getDobError(value: Date | null) {
  if (!value) {
    return 'Select your date of birth to continue.';
  }

  const dobValue = toDobValue(value);
  const age = getAgeFromDob(dobValue);
  if (!age || age > 100) {
    return 'Select a valid date of birth.';
  }

  if (age < 18) {
    return 'You need to be 18 or older to use Toogether.';
  }

  return '';
}

function formatDob(value: Date | null) {
  if (!value) {
    return 'Select date of birth';
  }

  return value.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function toDobValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

type Gender = 'man' | 'woman' | 'other';

const genderOptions: { id: Gender; label: string; emoji: string }[] = [
  { id: 'man', label: 'Man', emoji: '👨' },
  { id: 'woman', label: 'Woman', emoji: '👩' },
  { id: 'other', label: 'Other', emoji: '🧑' },
];

export default function NewUserProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, updateCurrentUser } = useApp();
  const [name, setName] = useState(currentUser?.name ?? '');
  const [dob, setDob] = useState<Date | null>(currentUser?.dob ? new Date(currentUser.dob) : null);
  const [gender, setGender] = useState<Gender>(currentUser?.gender ?? 'man');
  const [avatarUri, setAvatarUri] = useState(currentUser?.avatarUri);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) {
    return null;
  }

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0]?.uri);
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dob ?? new Date(2000, 0, 1),
        mode: 'date',
        maximumDate: new Date(),
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            setDob(selectedDate);
          }
        },
      });
      return;
    }

    setShowDatePicker(true);
  };

  const continueToVerification = () => {
    const trimmedName = name.trim();
    const dobValue = dob ? toDobValue(dob) : '';
    const age = getAgeFromDob(dobValue);
    const dobError = getDobError(dob);

    if (!trimmedName) {
      setError('Add your name to continue.');
      return;
    }

    if (dobError || !age) {
      setError(dobError);
      return;
    }

    updateCurrentUser({
      name: trimmedName,
      dob: dobValue,
      age,
      avatarUri,
      gender,
    });
    router.push('/new-user-verification');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 18,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 6,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>Set up your profile</Text>
        <Text style={{ color: colors.muted }}>Name, gender, and DOB are required. Photo is optional.</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Pressable
            onPress={pickPhoto}
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              backgroundColor: '#EFF6FF',
              borderWidth: 1,
              borderColor: avatarUri ? colors.primary : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: 104, height: 104 }} />
            ) : (
              <Ionicons name="camera-outline" size={28} color={colors.primary} />
            )}
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Add a profile picture</Text>
          <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
            A clear photo helps hosts recognize you before approving plans.
          </Text>
        </View>

        <FormField label="Full name" value={name} onChangeText={setName} placeholder="Aisha Thomas" />

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>I am a</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {genderOptions.map((option) => {
              const active = option.id === gender;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setGender(option.id)}
                  style={{
                    flex: 1,
                    backgroundColor: active ? '#EEF6FF' : '#FFFFFF',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    paddingVertical: 14,
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{option.emoji}</Text>
                  <Text style={{ color: active ? colors.primary : colors.muted, fontWeight: '800', fontSize: 13 }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            This is used for women-only plan visibility. It stays private and is never shown publicly.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Date of birth</Text>
          <Pressable
            onPress={openDatePicker}
            style={{
              minHeight: 54,
              borderRadius: 18,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: error && !dob ? colors.danger : colors.border,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Text style={{ color: dob ? colors.text : '#9CA3AF', fontSize: 15 }}>{formatDob(dob)}</Text>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {error ? <Text style={{ color: colors.danger, fontWeight: '700' }}>{error}</Text> : null}

        <GradientButton label="Continue" onPress={continueToVerification} fullWidth />
      </ScrollView>

      {Platform.OS !== 'android' && showDatePicker ? (
        <Modal transparent animationType="fade" visible={showDatePicker}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <View style={{ backgroundColor: '#FFFFFF', padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <DateTimePicker
                value={dob ?? new Date(2000, 0, 1)}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_event, selectedDate) => {
                  if (selectedDate) {
                    setDob(selectedDate);
                  }
                }}
              />
              <GradientButton label="Done" onPress={() => setShowDatePicker(false)} fullWidth />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
