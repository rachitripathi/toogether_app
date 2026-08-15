import { router } from 'expo-router';
import { CameraType } from 'expo-image-picker';
import { PhotoCaptureScreen } from '@/components/verification/PhotoCaptureScreen';
import { useVerificationDraftStore } from '@/store/verificationDraftStore';

export default function LivenessScreen() {
  const setSelfie = useVerificationDraftStore((s) => s.setSelfie);

  const handleConfirm = (uri: string) => {
    setSelfie(uri);
    router.push('/verification/review');
  };

  return (
    <PhotoCaptureScreen
      stepLabel="Step 3 of 3"
      title="Selfie"
      hints={['Look straight at the camera', 'Make sure your face is clearly visible and well lit']}
      previewCaption="Make sure your face is clearly visible and well lit."
      cameraType={CameraType.front}
      onConfirm={handleConfirm}
      onBack={() => router.back()}
    />
  );
}
