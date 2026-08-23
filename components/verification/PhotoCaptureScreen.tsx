import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

type PhotoCaptureScreenProps = {
  stepLabel: string;
  title: string;
  hints: string[];
  previewCaption: string;
  cameraType: ImagePicker.CameraType;
  onConfirm: (uri: string) => void;
  onBack: () => void;
};

export function PhotoCaptureScreen({
  stepLabel,
  title,
  hints,
  previewCaption,
  cameraType,
  onConfirm,
  onBack,
}: PhotoCaptureScreenProps) {
  const insets = useSafeAreaInsets();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCamera = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let permission = await ImagePicker.getCameraPermissionsAsync();
      if (!permission.granted) {
        permission = await ImagePicker.requestCameraPermissionsAsync();
      }
      if (!permission.granted) {
        setPermissionDenied(!permission.canAskAgain);
        return;
      }
      setPermissionDenied(false);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        cameraType,
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setPreviewUri(result.assets[0].uri);
      }
    } catch {
      setError("Couldn't open the camera. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
          <Ionicons name="camera-outline" size={40} color="rgba(255,255,255,0.5)" />
        </View>
      )}

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 14, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={onBack}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </Pressable>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>{stepLabel}</Text>
          </View>
        </View>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 16) + 20, paddingHorizontal: 24, gap: 16 }}>
        {previewUri ? (
          <>
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 18, textAlign: 'center' }}>{title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontSize: 13 }}>{previewCaption}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setPreviewUri(null)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Retake</Text>
              </Pressable>
              <Pressable
                onPress={() => onConfirm(previewUri)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 20, backgroundColor: '#FFFFFF' }}
              >
                <Text style={{ color: '#000000', fontWeight: '800' }}>Use this photo</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 18, padding: 14, gap: 6 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15 }}>{title}</Text>
              {hints.map((hint) => (
                <View key={hint} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="bulb-outline" size={14} color="#FDE7B3" />
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5 }}>{hint}</Text>
                </View>
              ))}
            </View>
            {permissionDenied ? (
              <>
                <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontSize: 13 }}>
                  Camera access was denied. Enable it in Settings to continue.
                </Text>
                <Pressable
                  onPress={() => Linking.openSettings()}
                  style={{ alignItems: 'center', paddingVertical: 16, borderRadius: 20, backgroundColor: '#FFFFFF' }}
                >
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Open Settings</Text>
                </Pressable>
              </>
            ) : (
              <>
                {error ? (
                  <Text style={{ color: '#FCA5A5', textAlign: 'center', fontSize: 13 }}>{error}</Text>
                ) : null}
                <Pressable
                  onPress={openCamera}
                  disabled={busy}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    paddingVertical: 16,
                    borderRadius: 20,
                    backgroundColor: '#FFFFFF',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Ionicons name="camera" size={20} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Take Photo</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}
