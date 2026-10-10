import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/utils/supabase';

// Public identifiers, not secrets — safe to bundle into the client. Hardcoded rather than
// read from env, matching utils/supabase.ts's pattern for this project.
const CLOUD_NAME = 'defn6q2gc';
const UPLOAD_PRESET = 'toogether_avatars';
// Verification documents (Aadhaar, selfie) use a separate unsigned preset from avatars —
// keeps sensitive ID photos out of the public-avatar asset pool. Must be created once in
// the Cloudinary dashboard (unsigned upload preset named "toogether_verification").
const VERIFICATION_UPLOAD_PRESET = 'toogether_verification';

const extensionToMimeType: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

// Camera captures come straight off the sensor at full resolution (often 8-12MP, several
// MB each) — launchCameraAsync's own `quality` option only controls JPEG compression, not
// pixel dimensions. Downscaling to a sane max width before upload cuts payload size (and
// therefore upload time) dramatically while staying plenty legible for ID review.
//
// Returns the shrunk photo as a base64 data URI, or null if shrinking isn't possible (then the
// original file is uploaded instead). expo-image-manipulator is a native module added on
// 2026-08-25, so an app binary built before that doesn't have it and the call throws. When this
// step was mandatory, that blocked every photo upload, avatars and verification alike.
async function shrinkToDataUri(localUri: string): Promise<string | null> {
  try {
    const image = await ImageManipulator.manipulate(localUri).resize({ width: 1600 }).renderAsync();
    const result = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
    return result.base64 ? `data:image/jpeg;base64,${result.base64}` : null;
  } catch (error) {
    console.warn('Could not shrink photo before upload, sending the original:', error);
    return null;
  }
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Two ways to send the photo:
//   - Preferred: the shrunk photo as a base64 data URI in a plain JSON body, which Cloudinary
//     accepts for `file`. No local file is involved, which sidesteps React Native's multipart
//     file upload. That path fails with a bare "Network request failed" (seen in Expo Go on
//     2026-10-11) whenever the native side can't read or stream the file.
//   - Fallback, when shrinking isn't available: the original file as multipart form data, the
//     way uploads worked before 2026-08-25.
async function uploadToCloudinary(localUri: string, uploadPreset: string, fallbackName: string): Promise<string> {
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const dataUri = await shrinkToDataUri(localUri);

  let request: RequestInit;
  if (dataUri) {
    request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: dataUri, upload_preset: uploadPreset }),
    };
  } else {
    const filename = localUri.split('/').pop() ?? fallbackName;
    const extension = /\.(\w+)$/.exec(filename)?.[1]?.toLowerCase() ?? 'jpg';
    const mimeType = extensionToMimeType[extension] ?? 'image/jpeg';
    const form = new FormData();
    // React Native's fetch/FormData accepts this {uri,name,type} shape in place of a Blob.
    form.append('file', { uri: localUri, name: filename, type: mimeType } as unknown as Blob);
    form.append('upload_preset', uploadPreset);
    request = { method: 'POST', body: form };
  }

  let response: Response;
  try {
    response = await fetch(endpoint, request);
  } catch (error) {
    // Keep the underlying reason: "Network request failed" vs. a timeout vs. something else
    // is what tells these failures apart.
    throw new Error(`Couldn't reach the photo server (${describe(error)}). Check your connection and try again.`);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Cloudinary's own message (e.g. a preset problem), so it can be reported back as-is.
    throw new Error(`Photo upload was refused: ${data?.error?.message ?? `HTTP ${response.status}`}`);
  }

  return data.secure_url as string;
}

// Unsigned uploads only need the cloud name + a preset (see "toogether_avatars" in the
// Cloudinary dashboard), neither of which is a secret, so this is safe to call directly
// from the device — no API key/secret involved.
export async function uploadAvatar(localUri: string): Promise<string> {
  return uploadToCloudinary(localUri, UPLOAD_PRESET, `avatar-${Date.now()}.jpg`);
}

// Same unsigned-upload shape as uploadAvatar, but posts to a dedicated preset so Aadhaar
// and selfie photos captured during verification don't land in the public avatar pool.
export async function uploadVerificationDocument(localUri: string): Promise<string> {
  return uploadToCloudinary(localUri, VERIFICATION_UPLOAD_PRESET, `verification-${Date.now()}.jpg`);
}

// Deleting a Cloudinary asset requires a signed Admin API call, which needs the account's
// API secret. That secret must never ship inside the app bundle, so the actual delete is
// done by the "delete-avatar" Supabase Edge Function (see supabase/functions/delete-avatar),
// which holds the secret server-side and only ever deletes the calling user's own avatar —
// it looks up profiles.avatar_uri for the authenticated user itself (deriving the Cloudinary
// public_id from that URL), so the client can never target anyone else's photo.
export async function deleteCurrentAvatar(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-avatar');
  if (error) {
    console.error('Error deleting previous avatar:', error);
  }
}
