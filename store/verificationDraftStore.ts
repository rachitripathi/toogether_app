import { create } from 'zustand';

type VerificationDraftStore = {
  aadhaarFrontUri: string | null;
  aadhaarBackUri: string | null;
  selfieUri: string | null;
  setAadhaarFront: (uri: string | null) => void;
  setAadhaarBack: (uri: string | null) => void;
  setSelfie: (uri: string | null) => void;
  reset: () => void;
};

// Holds captured-but-not-yet-submitted verification photos across the multi-screen
// capture flow (app/verification/*). Never persisted — cleared on submit or on leaving
// the flow, since these are sensitive local file URIs, not something to keep around.
export const useVerificationDraftStore = create<VerificationDraftStore>((set) => ({
  aadhaarFrontUri: null,
  aadhaarBackUri: null,
  selfieUri: null,
  setAadhaarFront: (uri) => set({ aadhaarFrontUri: uri }),
  setAadhaarBack: (uri) => set({ aadhaarBackUri: uri }),
  setSelfie: (uri) => set({ selfieUri: uri }),
  reset: () => set({ aadhaarFrontUri: null, aadhaarBackUri: null, selfieUri: null }),
}));
