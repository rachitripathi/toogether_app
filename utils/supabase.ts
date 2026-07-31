import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const isSSR = typeof window === "undefined";

const ExpoWebSecureStoreAdapter = {
  getItem: (key: string) => {
    if (isSSR) return null;
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (isSSR) return;
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (isSSR) return;
    return AsyncStorage.removeItem(key);
  },
};

// const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

const supabaseUrl = "https://najyegewtbeyigppuufy.supabase.co";
const supabaseKey = "sb_publishable_pDw3N9foURXtQxbiTXt2aQ_Ylwziwcs";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars — check your .env file");
}

const FETCH_TIMEOUT_MS = 10000;

// supabase-js's own network calls have no timeout — a hung request (e.g. right
// at cold start, before the network stack has fully reassociated) never
// resolves or rejects, which holds auth-js's internal operation lock forever.
// Every later auth call (including a brand new signInWithPassword) queues
// behind that same dead lock and hangs too, until the process is killed.
// Aborting the underlying fetch after a fixed timeout guarantees it always
// settles, so the lock always gets released instead of staying poisoned.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: init?.signal ?? controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
};

// NOTE: deliberately NOT wiring AppState -> startAutoRefresh()/stopAutoRefresh() here.
// That's Supabase's documented RN pattern, but community reports (supabase/supabase
// discussion #36906) show startAutoRefresh() can fire a refresh right as the app
// resumes, before the network is actually up, and a failed refresh makes the SDK
// delete the local session — logging the user out. autoRefreshToken: true still
// refreshes on a timer while the app is foregrounded and on-demand whenever
// getSession()/getClaims() is called, which covers this app's needs without that risk.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: ExpoWebSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
