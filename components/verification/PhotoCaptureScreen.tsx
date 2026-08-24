import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// This is a full-bleed camera overlay (like a native camera viewfinder), not a themed
// app screen — it stays dark chrome with white text/buttons regardless of light/dark
// mode, so colors here are pinned literals rather than theme tokens on purpose.
const ON_LIGHT_BUTTON_TEXT = '#111827';

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
      } else if (result.canceled) {
        // User backed out of the native camera without taking a shot — they came from
        // an explicit "Add"/"Retake" tap on the documents checklist, so the least
        // surprising thing is to drop them right back there instead of stranding them
        // on this now-pointless black screen.
        onBack();
      }
    } catch {
      setError("Couldn't open the camera. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Arriving on this screen already means the user explicitly chose to add/retake this
  // specific document (tapped it on the checklist), so ask for permission and open the
  // camera immediately — no extra "Take Photo" tap in between. The manual button below
  // still exists as the retry path if this fails or permission is denied.
  const autoLaunchedRef = useRef(false);
  useEffect(() => {
    if (autoLaunchedRef.current) return;
    autoLaunchedRef.current = true;
    openCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
          <Icon name="camera-outline" size={40} color="rgba(255,255,255,0.5)" />
        </View>
      )}

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 14, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={onBack}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="arrow-back" size={18} color="#FFFFFF" />
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
                  <Icon name="bulb-outline" size={14} color="#FDE7B3" />
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
                  <Text style={{ color: ON_LIGHT_BUTTON_TEXT, fontWeight: '800', fontSize: 15 }}>Open Settings</Text>
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
                  <Icon name="camera" size={20} color={ON_LIGHT_BUTTON_TEXT} />
                  <Text style={{ color: ON_LIGHT_BUTTON_TEXT, fontWeight: '800', fontSize: 15 }}>Take Photo</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}
