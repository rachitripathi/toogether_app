import { useLocalSearchParams, router } from 'expo-router';
import { CameraType } from 'expo-image-picker';
import { PhotoCaptureScreen } from '@/components/verification/PhotoCaptureScreen';
import { useVerificationDraftStore } from '@/store/verificationDraftStore';

type Doc = 'front' | 'back' | 'selfie';

const DOC_CONFIG: Record<Doc, { label: string; hints: string[]; previewCaption: string; cameraType: CameraType }> = {
  front: {
    label: 'Aadhaar — front',
    hints: ['Fit the whole card inside the frame', 'Use good light and avoid glare'],
    previewCaption: 'Check that the text is sharp and readable before continuing.',
    cameraType: CameraType.back,
  },
  back: {
    label: 'Aadhaar — back',
    hints: ['Make sure all four corners are visible', 'Hold steady so the text stays sharp'],
    previewCaption: 'Check that the text is sharp and readable before continuing.',
    cameraType: CameraType.back,
  },
  selfie: {
    label: 'Selfie',
    hints: ['Look straight at the camera', 'Make sure your face is clearly visible and well lit'],
    previewCaption: 'Make sure your face is clearly visible and well lit.',
    cameraType: CameraType.front,
  },
};

export default function CaptureDocumentScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const setAadhaarFront = useVerificationDraftStore((s) => s.setAadhaarFront);
  const setAadhaarBack = useVerificationDraftStore((s) => s.setAadhaarBack);
  const setSelfie = useVerificationDraftStore((s) => s.setSelfie);

  const resolvedDoc: Doc = doc === 'back' || doc === 'selfie' ? doc : 'front';
  const config = DOC_CONFIG[resolvedDoc];

  const handleConfirm = (uri: string) => {
    if (resolvedDoc === 'front') setAadhaarFront(uri);
    else if (resolvedDoc === 'back') setAadhaarBack(uri);
    else setSelfie(uri);
    router.back();
  };

  return (
    <PhotoCaptureScreen
      key={resolvedDoc}
      stepLabel={config.label}
      title={config.label}
      hints={config.hints}
      previewCaption={config.previewCaption}
      cameraType={config.cameraType}
      onConfirm={handleConfirm}
      onBack={() => router.back()}
    />
  );
}
