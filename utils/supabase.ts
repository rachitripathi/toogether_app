import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isSSR = typeof window === "undefined";

const WebStorageAdapter = {
  getItem: (key: string) => (isSSR ? null : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    isSSR ? undefined : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    isSSR ? undefined : AsyncStorage.removeItem(key),
};

// SecureStore has a ~2048 byte limit per value. Supabase sessions (JWT + refresh
// token + user metadata) regularly exceed this, so large values get chunked
// across multiple keys and reassembled on read.
const CHUNK_SIZE = 1800; // leave headroom under the 2048 byte cap

const NativeSecureStoreAdapter = {
  getItem: async (key: string) => {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!chunkCountRaw) {
      // not chunked — try reading directly (covers small values / backward compat)
      return SecureStore.getItemAsync(key);
    }
    const chunkCount = parseInt(chunkCountRaw, 10);
    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk === null) return null; // corrupted/missing chunk
      chunks.push(chunk);
    }
    return chunks.join("");
  },
  setItem: async (key: string, value: string) => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
      return;
    }
    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunkCount; i++) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}_${i}`, chunk);
    }
    await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount));
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
  removeItem: async (key: string) => {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCountRaw) {
      const chunkCount = parseInt(chunkCountRaw, 10);
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

const authStorage =
  Platform.OS === "web" ? WebStorageAdapter : NativeSecureStoreAdapter;

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
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
