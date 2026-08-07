import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';
import { uploadVerificationDocument } from '@/lib/cloudinary';
import { useApp } from '@/providers/AppProvider';
import { useVerificationDraftStore } from '@/store/verificationDraftStore';

const CHECKLIST = [
  'Text on the Aadhaar card is sharp and readable',
  'All four corners of the card are visible',
  'No glare, shadows, or blur',
  'Your face is clearly visible in the selfie',
];

export default function ReviewVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { submitVerification } = useApp();
  const { aadhaarFrontUri, aadhaarBackUri, selfieUri, reset } = useVerificationDraftStore();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!aadhaarFrontUri || !aadhaarBackUri || !selfieUri) {
      router.replace('/verification/capture-aadhaar');
    }
  }, [aadhaarFrontUri, aadhaarBackUri, selfieUri]);

  if (!aadhaarFrontUri || !aadhaarBackUri || !selfieUri) {
    return null;
  }

  const photos = [
    { key: 'front', label: 'Aadhaar — front', uri: aadhaarFrontUri },
    { key: 'back', label: 'Aadhaar — back', uri: aadhaarBackUri },
    { key: 'selfie', label: 'Selfie', uri: selfieUri },
  ];

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const [frontUrl, backUrl, selfieUrl] = await Promise.all([
        uploadVerificationDocument(aadhaarFrontUri),
        uploadVerificationDocument(aadhaarBackUri),
        uploadVerificationDocument(selfieUri),
      ]);
      await submitVerification({ aadhaarFrontUri: frontUrl, aadhaarBackUri: backUrl, selfieUri: selfieUrl });
      reset();
      router.replace('/verification');
    } catch (error) {
      console.error('Failed to submit verification:', error);
      Alert.alert('Something went wrong', 'We could not submit your verification. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 14,
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
          disabled={submitting}
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Review & submit</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <Text style={{ color: colors.text, lineHeight: 21 }}>
          Double check your photos before submitting. You can retake any of them.
        </Text>

        <View style={{ gap: 14 }}>
          {photos.map((photo) => (
            <View
              key={photo.key}
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
              <Image source={{ uri: photo.uri }} style={{ width: 72, height: 56, borderRadius: 12, backgroundColor: colors.border }} resizeMode="cover" />
              <Text style={{ flex: 1, color: colors.text, fontWeight: '800' }}>{photo.label}</Text>
              <Pressable
                disabled={submitting}
                onPress={() =>
                  router.push(photo.key === 'selfie' ? '/verification/liveness' : '/verification/capture-aadhaar')
                }
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12.5 }}>Retake</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>Before you submit</Text>
          {CHECKLIST.map((item) => (
            <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Ionicons name="checkmark-circle" size={18} color="#15803D" style={{ marginTop: 1 }} />
              <Text style={{ color: colors.text, lineHeight: 20, flex: 1, fontSize: 13.5 }}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: '#FFF7E8', borderRadius: 20, borderWidth: 1, borderColor: '#FDE7B3', padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Ionicons name="time-outline" size={20} color="#B45309" style={{ marginTop: 1 }} />
          <Text style={{ color: '#92400E', lineHeight: 20, flex: 1, fontSize: 13 }}>
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
      </ScrollView>
    </View>
  );
}
