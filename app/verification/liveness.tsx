import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { Camera, type Face } from 'react-native-vision-camera-face-detector';
import { DEV_TOOLS_ENABLED } from '@/lib/devTools';
import { useVerificationDraftStore } from '@/store/verificationDraftStore';

type LivenessStep = 'center' | 'blink' | 'turnLeft' | 'turnRight';

const STEP_ORDER: LivenessStep[] = ['center', 'blink', 'turnLeft', 'turnRight'];

const STEP_COPY: Record<LivenessStep, { title: string; hint: string }> = {
  center: { title: 'Look straight at the camera', hint: 'Center your face inside the circle' },
  blink: { title: 'Blink both eyes', hint: 'Blink naturally, once' },
  // Sign of yawAngle depends on device/ML Kit orientation handling — verify the
  // left/right mapping feels correct on a real device and flip YAW_THRESHOLD's
  // sign below if the prompts feel reversed.
  turnLeft: { title: 'Turn your head left', hint: 'Slowly turn until you pass the line' },
  turnRight: { title: 'Now turn right', hint: 'Slowly turn the other way' },
};

const YAW_TURN_THRESHOLD = 18;
const YAW_CENTER_THRESHOLD = 12;
const CENTER_HOLD_MS = 600;
const EYES_CLOSED_THRESHOLD = 0.4;
const EYES_OPEN_THRESHOLD = 0.65;
const STEP_RETRY_HINT_MS = 8000;

export default function LivenessScreen() {
  const insets = useSafeAreaInsets();
  const device = useCameraDevice('front');
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ quality: 0.85 });
  const setSelfie = useVerificationDraftStore((s) => s.setSelfie);

  const [stepIndex, setStepIndex] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [showRetryHint, setShowRetryHint] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stepRef = useRef<LivenessStep>('center');
  const centerSinceRef = useRef<number | null>(null);
  const blinkClosedRef = useRef(false);

  const allStepsDone = stepIndex >= STEP_ORDER.length;
  const currentStep = STEP_ORDER[stepIndex];

  useEffect(() => {
    stepRef.current = currentStep ?? 'turnRight';
  }, [currentStep]);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  useEffect(() => {
    setShowRetryHint(false);
    if (allStepsDone) return;
    const timeout = setTimeout(() => setShowRetryHint(true), STEP_RETRY_HINT_MS);
    return () => clearTimeout(timeout);
  }, [stepIndex, allStepsDone]);

  const advanceStep = useCallback(() => {
    centerSinceRef.current = null;
    blinkClosedRef.current = false;
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length));
  }, []);

  const handleFacesDetected = useCallback(
    (faces: Face[]) => {
      const face = faces[0];
      setFaceDetected(!!face);
      if (!face) {
        centerSinceRef.current = null;
        return;
      }

      switch (stepRef.current) {
        case 'center': {
          if (Math.abs(face.yawAngle) < YAW_CENTER_THRESHOLD) {
            if (centerSinceRef.current == null) {
              centerSinceRef.current = Date.now();
            } else if (Date.now() - centerSinceRef.current > CENTER_HOLD_MS) {
              advanceStep();
            }
          } else {
            centerSinceRef.current = null;
          }
          break;
        }
        case 'blink': {
          const left = face.leftEyeOpenProbability ?? 1;
          const right = face.rightEyeOpenProbability ?? 1;
          const avgOpen = (left + right) / 2;
          if (!blinkClosedRef.current && avgOpen < EYES_CLOSED_THRESHOLD) {
            blinkClosedRef.current = true;
          } else if (blinkClosedRef.current && avgOpen > EYES_OPEN_THRESHOLD) {
            advanceStep();
          }
          break;
        }
        case 'turnLeft': {
          if (face.yawAngle > YAW_TURN_THRESHOLD) {
            advanceStep();
          }
          break;
        }
        case 'turnRight': {
          if (face.yawAngle < -YAW_TURN_THRESHOLD) {
            advanceStep();
          }
          break;
        }
      }
    },
    [advanceStep]
  );

  const captureSelfie = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const file = await photoOutput.capturePhotoToFile({}, {});
      setPreviewUri(`file://${file.filePath}`);
    } catch (error) {
      console.error('Failed to capture selfie:', error);
    } finally {
      setCapturing(false);
    }
  }, [capturing, photoOutput]);

  useEffect(() => {
    if (allStepsDone && !previewUri && !capturing) {
      captureSelfie();
    }
  }, [allStepsDone, previewUri, capturing, captureSelfie]);

  const confirmSelfie = () => {
    if (!previewUri) return;
    setSelfie(previewUri);
    router.push('/verification/review');
  };

  const retake = () => {
    setPreviewUri(null);
    setStepIndex(0);
    centerSinceRef.current = null;
    blinkClosedRef.current = false;
  };

  const handleBack = () => {
    if (previewUri) {
      retake();
      return;
    }
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : hasPermission && device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          outputs={[photoOutput]}
          isActive={!allStepsDone}
          runClassifications
          runLandmarks
          performanceMode="fast"
          onFacesDetected={handleFacesDetected}
          onError={(error) => console.error('Face detector error:', error)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }]}>
          <Ionicons name="camera-outline" size={40} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
            {device ? 'Camera access needed' : 'No front camera found'}
          </Text>
          {device ? (
            <>
              <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 }}>
                Toogether needs your front camera for a quick liveness check.
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
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>Step 3 of 3</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {STEP_ORDER.map((s, i) => (
              <View
                key={s}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: i < stepIndex ? '#4ADE80' : i === stepIndex ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </View>
        </View>
      </View>

      {!previewUri && hasPermission && device ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <View
            style={{
              width: 250,
              height: 250,
              borderRadius: 125,
              borderWidth: 3,
              borderColor: faceDetected ? '#4ADE80' : 'rgba(255,255,255,0.6)',
            }}
          />
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 16) + 20, paddingHorizontal: 24, gap: 14 }}>
        {previewUri ? (
          <>
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 18, textAlign: 'center' }}>Selfie captured</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontSize: 13 }}>
              Make sure your face is clearly visible and well lit.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={retake}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Retake</Text>
              </Pressable>
              <Pressable
                onPress={confirmSelfie}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 20, backgroundColor: '#FFFFFF' }}
              >
                <Text style={{ color: '#000000', fontWeight: '800' }}>Use this photo</Text>
              </Pressable>
            </View>
          </>
        ) : allStepsDone ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Capturing your selfie…</Text>
          </View>
        ) : hasPermission && device ? (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 18, padding: 16, gap: 6, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 17, textAlign: 'center' }}>
              {STEP_COPY[currentStep].title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center' }}>
              {STEP_COPY[currentStep].hint}
            </Text>
            {showRetryHint ? (
              <Text style={{ color: '#FDE7B3', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                Didn't quite catch that — keep trying, or make sure your face is well lit.
              </Text>
            ) : null}
            {DEV_TOOLS_ENABLED ? (
              <Pressable onPress={advanceStep} style={{ marginTop: 10, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' }}>Skip step (dev)</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
