import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { colors } from '@/lib/theme';
import { useVerificationDraftStore } from '@/store/verificationDraftStore';

type Step = 'front' | 'back';

const STEP_COPY: Record<Step, { stepLabel: string; title: string; hints: string[] }> = {
  front: {
    stepLabel: 'Step 1 of 3',
    title: 'Aadhaar — front',
    hints: ['Fit the whole card inside the frame', 'Use good light and avoid glare'],
  },
  back: {
    stepLabel: 'Step 2 of 3',
    title: 'Aadhaar — back',
    hints: ['Make sure all four corners are visible', 'Hold steady so the text stays sharp'],
  },
};

export default function CaptureAadhaarScreen() {
  const insets = useSafeAreaInsets();
  const device = useCameraDevice('back');
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ quality: 0.85 });
  const [step, setStep] = useState<Step>('front');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const setAadhaarFront = useVerificationDraftStore((s) => s.setAadhaarFront);
  const setAadhaarBack = useVerificationDraftStore((s) => s.setAadhaarBack);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  const takePhoto = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const file = await photoOutput.capturePhotoToFile({}, {});
      setPreviewUri(`file://${file.filePath}`);
    } catch (error) {
      console.error('Failed to capture Aadhaar photo:', error);
    } finally {
      setCapturing(false);
    }
  };

  const confirmPhoto = () => {
    if (!previewUri) return;
    if (step === 'front') {
      setAadhaarFront(previewUri);
      setPreviewUri(null);
      setStep('back');
    } else {
      setAadhaarBack(previewUri);
      setPreviewUri(null);
      router.push('/verification/liveness');
    }
  };

  const handleBack = () => {
    if (previewUri) {
      setPreviewUri(null);
      return;
    }
    if (step === 'back') {
      setStep('front');
      return;
    }
    router.back();
  };

  const copy = STEP_COPY[step];

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : hasPermission && device ? (
        <Camera style={StyleSheet.absoluteFill} device={device} outputs={[photoOutput]} isActive />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }]}>
          <Ionicons name="camera-outline" size={40} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
            {device ? 'Camera access needed' : 'No camera found'}
          </Text>
          {device ? (
            <>
              <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 }}>
                Toogether needs your camera to verify your Aadhaar card. Your camera is never used for anything else.
              </Text>
              <Pressable
                onPress={() => (canRequestPermission ? requestPermission() : Linking.openSettings())}
                style={{ backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 24, marginTop: 6 }}
              >
                <Text style={{ color: '#000000', fontWeight: '800' }}>
                  {canRequestPermission ? 'Allow camera access' : 'Open Settings'}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      )}

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 14, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={handleBack}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </Pressable>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>{copy.stepLabel}</Text>
          </View>
        </View>
      </View>

      {!previewUri && hasPermission && device ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <View
            style={{
              width: '84%',
              aspectRatio: 1.586,
              borderRadius: 18,
              borderWidth: 3,
              borderColor: 'rgba(255,255,255,0.85)',
            }}
          />
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 16) + 20, paddingHorizontal: 24, gap: 16 }}>
        {previewUri ? (
          <>
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 18, textAlign: 'center' }}>{copy.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontSize: 13 }}>
              Check that the text is sharp and readable before continuing.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setPreviewUri(null)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Retake</Text>
              </Pressable>
              <Pressable
                onPress={confirmPhoto}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 20, backgroundColor: '#FFFFFF' }}
              >
                <Text style={{ color: '#000000', fontWeight: '800' }}>Use this photo</Text>
              </Pressable>
            </View>
          </>
        ) : hasPermission && device ? (
          <>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 18, padding: 14, gap: 6 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15 }}>{copy.title}</Text>
              {copy.hints.map((hint) => (
                <View key={hint} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="bulb-outline" size={14} color="#FDE7B3" />
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5 }}>{hint}</Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={takePhoto}
              disabled={capturing}
              style={{
                alignSelf: 'center',
                width: 74,
                height: 74,
                borderRadius: 37,
                backgroundColor: '#FFFFFF',
                borderWidth: 4,
                borderColor: 'rgba(255,255,255,0.4)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {capturing ? <ActivityIndicator color={colors.text} /> : null}
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
