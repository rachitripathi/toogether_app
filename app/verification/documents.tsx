import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { Icon } from '@/components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useVerificationDraftStore } from '@/store/verificationDraftStore';

const CHECKLIST = [
  'Text on the Aadhaar card is sharp and readable',
  'All four corners of the card are visible',
  'No glare, shadows, or blur',
  'Your face is clearly visible in the selfie',
];

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { submitVerification } = useApp();
  const { colors } = useTheme();
  const { aadhaarFrontUri, aadhaarBackUri, selfieUri, reset } = useVerificationDraftStore();
  const [submitting, setSubmitting] = useState(false);

  const photos = [
    { key: 'front' as const, label: 'Aadhaar — front', uri: aadhaarFrontUri },
    { key: 'back' as const, label: 'Aadhaar — back', uri: aadhaarBackUri },
    { key: 'selfie' as const, label: 'Selfie', uri: selfieUri },
  ];
  const allCaptured = photos.every((photo) => photo.uri);

  // submitVerification only awaits the (fast) status flip — the slow photo uploads run in
  // the background from AppProvider itself, so this can't hang for long. Still, block
  // every way off this screen while it's in flight: the header back button is already
  // disabled via `submitting`, but neither the Android hardware back button nor the iOS
  // edge-swipe gesture respect that, and navigating away mid-await used to leave this
  // screen calling setState/navigation on itself after it had already unmounted.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !submitting });
  }, [submitting, navigation]);

  useEffect(() => {
    if (!submitting) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [submitting]);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (submitting || !aadhaarFrontUri || !aadhaarBackUri || !selfieUri) return;
    setSubmitting(true);
    try {
      await submitVerification({ aadhaarFrontUri, aadhaarBackUri, selfieUri });
      reset();
      if (!mountedRef.current) return;
      router.dismissTo('/verification');
    } catch (error) {
      console.error('Failed to submit verification:', error);
      if (mountedRef.current) {
        Alert.alert('Something went wrong', 'We could not submit your verification. Please check your connection and try again.');
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 14,
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
          disabled={submitting}
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>
          {allCaptured ? 'Review & submit' : 'Add your documents'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <Text style={{ color: colors.text, lineHeight: 21 }}>
          {allCaptured
            ? 'Double check your photos before submitting. You can retake any of them.'
            : 'Tap each item below to take that photo. You can retake any of them before submitting.'}
        </Text>

        <View style={{ gap: 14 }}>
          {photos.map((photo) => (
            <Pressable
              key={photo.key}
              disabled={submitting}
              onPress={() => router.push({ pathname: '/verification/capture', params: { doc: photo.key } })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: colors.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
              }}
            >
              {photo.uri ? (
                <Image source={{ uri: photo.uri }} style={{ width: 72, height: 56, borderRadius: 12, backgroundColor: colors.border }} resizeMode="cover" />
              ) : (
                <View
                  style={{
                    width: 72,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: colors.page,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderStyle: 'dashed',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="camera-outline" size={20} color={colors.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{photo.label}</Text>
                <Text style={{ color: photo.uri ? colors.success : colors.muted, fontSize: 12, marginTop: 2, fontWeight: '700' }}>
                  {photo.uri ? 'Added' : 'Not added yet'}
                </Text>
              </View>
              <View
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: photo.uri ? colors.border : colors.primary,
                  backgroundColor: photo.uri ? 'transparent' : colors.primary,
                }}
              >
                <Text style={{ color: photo.uri ? colors.text : '#FFFFFF', fontWeight: '800', fontSize: 12.5 }}>
                  {photo.uri ? 'Retake' : 'Add'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {allCaptured ? (
          <>
            <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>Before you submit</Text>
              {CHECKLIST.map((item) => (
                <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="checkmark-circle" size={18} color={colors.status.success.text} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.text, lineHeight: 20, flex: 1, fontSize: 13.5 }}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={{ backgroundColor: colors.status.warning.bg, borderRadius: 20, borderWidth: 1, borderColor: colors.status.warning.border, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="time-outline" size={20} color={colors.status.warning.text} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.status.warning.text, lineHeight: 20, flex: 1, fontSize: 13 }}>
                Verification can take up to 72 hours after you submit.
              </Text>
            </View>

            <GradientButton
              label={submitting ? 'Submitting…' : 'Submit for review'}
              onPress={handleSubmit}
              disabled={submitting}
              icon={submitting ? <ActivityIndicator color="#FFFFFF" /> : undefined}
              fullWidth
            />
          </>
        ) : (
          <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>
            Add all three photos above to continue.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
