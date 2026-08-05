import { supabase } from '@/utils/supabase';

// Public identifiers, not secrets — safe to bundle into the client. Hardcoded rather than
// read from env, matching utils/supabase.ts's pattern for this project.
const CLOUD_NAME = 'defn6q2gc';
const UPLOAD_PRESET = 'toogether_avatars';

const extensionToMimeType: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

// Unsigned uploads only need the cloud name + a preset (see "toogether_avatars" in the
// Cloudinary dashboard), neither of which is a secret, so this is safe to call directly
// from the device — no API key/secret involved.
export async function uploadAvatar(localUri: string): Promise<string> {
  const filename = localUri.split('/').pop() ?? `avatar-${Date.now()}.jpg`;
  const extension = /\.(\w+)$/.exec(filename)?.[1]?.toLowerCase() ?? 'jpg';
  const mimeType = extensionToMimeType[extension] ?? 'image/jpeg';

  const form = new FormData();
  // React Native's fetch/FormData accepts this {uri,name,type} shape in place of a Blob.
  form.append('file', { uri: localUri, name: filename, type: mimeType } as unknown as Blob);
  form.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Failed to upload photo');
  }

  return data.secure_url as string;
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
