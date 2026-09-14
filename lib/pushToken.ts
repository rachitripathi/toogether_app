import { supabase } from '@/utils/supabase';

// The push token this device registered for the signed-in user. Module-level rather than a ref
// inside NotificationsProvider because the code that has to remove it — AppProvider.logout() —
// sits above that provider in the tree.
let registered: { userId: string; token: string } | null = null;

export function setRegisteredPushToken(value: { userId: string; token: string } | null) {
  registered = value;
}

// Must run while the session is still valid, i.e. before supabase.auth.signOut(): the
// push_tokens delete policy is `auth.uid() = user_id`, so the same delete sent after sign-out
// matches zero rows without returning an error, and the device keeps receiving the previous
// account's pushes.
export async function unregisterPushToken() {
  const current = registered;
  if (!current) {
    return;
  }
  registered = null;
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', current.userId)
    .eq('token', current.token);
  if (error) {
    console.error('Error removing push token:', error);
  }
}
