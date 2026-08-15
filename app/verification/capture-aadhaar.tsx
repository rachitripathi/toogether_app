import { useState } from 'react';
import { router } from 'expo-router';
import { CameraType } from 'expo-image-picker';
import { PhotoCaptureScreen } from '@/components/verification/PhotoCaptureScreen';
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
  const [step, setStep] = useState<Step>('front');
  const setAadhaarFront = useVerificationDraftStore((s) => s.setAadhaarFront);
  const setAadhaarBack = useVerificationDraftStore((s) => s.setAadhaarBack);

  const copy = STEP_COPY[step];

  const handleConfirm = (uri: string) => {
    if (step === 'front') {
      setAadhaarFront(uri);
      setStep('back');
    } else {
      setAadhaarBack(uri);
      router.push('/verification/liveness');
    }
  };

  const handleBack = () => {
    if (step === 'back') {
      setStep('front');
      return;
    }
    router.back();
  };

  return (
    <PhotoCaptureScreen
      key={step}
      stepLabel={copy.stepLabel}
      title={copy.title}
      hints={copy.hints}
      previewCaption="Check that the text is sharp and readable before continuing."
      cameraType={CameraType.back}
      onConfirm={handleConfirm}
      onBack={handleBack}
    />
  );
}
