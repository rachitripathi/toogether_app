import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as aesjs from "aes-js";
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

// SecureStore (Keychain/Keystore) caps a single value at ~2048 bytes, far
// below what a Supabase session (JWT + refresh token + user metadata)
// regularly needs. Rather than splitting the session across many chunked
// SecureStore keys (fragile: an app kill mid-write across N sequential
// writes easily leaves an inconsistent set of chunks, which silently reads
// back as "no session" and forces a fresh login), we follow Supabase's own
// documented pattern for Expo: keep only a small random AES key in
// SecureStore (one fast, well-under-the-cap Keychain/Keystore call) and
// store the actual session — encrypted with that key — in AsyncStorage,
// which has no practical size limit. Two writes total instead of many
// shrinks the "killed mid-write" corruption window dramatically.
const encryptValue = async (storageKey: string, value: string) => {
  const encryptionKey = await Crypto.getRandomBytesAsync(32);
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(storageKey, aesjs.utils.hex.fromBytes(encryptionKey));
  return aesjs.utils.hex.fromBytes(encryptedBytes);
};

const decryptValue = async (storageKey: string, encryptedHex: string) => {
  const encryptionKeyHex = await SecureStore.getItemAsync(storageKey);
  if (!encryptionKeyHex) {
    return null;
  }
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(encryptionKeyHex),
    new aesjs.Counter(1)
  );
  const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(encryptedHex));
  return aesjs.utils.utf8.fromBytes(decryptedBytes);
};

// One-time migration off the old chunked-SecureStore-only format, so
// existing logged-in users aren't logged out by this upgrade. Safe to
// remove once no build predating this change is still in the wild.
const migrateLegacyChunkedValue = async (key: string): Promise<string | null> => {
  const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
  let legacyValue: string | null = null;

  if (chunkCountRaw) {
    const chunkCount = parseInt(chunkCountRaw, 10);
    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk === null) {
        return null; // corrupted/incomplete legacy chunk set — nothing to migrate
      }
      chunks.push(chunk);
    }
    legacyValue = chunks.join("");
  } else {
    legacyValue = await SecureStore.getItemAsync(key);
  }

  if (!legacyValue) {
    return null;
  }

  const encryptedHex = await encryptValue(key, legacyValue);
  await AsyncStorage.setItem(key, encryptedHex);

  if (chunkCountRaw) {
    const chunkCount = parseInt(chunkCountRaw, 10);
    for (let i = 0; i < chunkCount; i++) {
      await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {});
    }
    await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
  } else {
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }

  return legacyValue;
};

const LargeSecureStoreAdapter = {
  getItem: async (key: string) => {
    const encryptedHex = await AsyncStorage.getItem(key);
    if (!encryptedHex) {
      return migrateLegacyChunkedValue(key);
    }
    return decryptValue(key, encryptedHex);
  },
  setItem: async (key: string, value: string) => {
    const encryptedHex = await encryptValue(key, value);
    await AsyncStorage.setItem(key, encryptedHex);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

const authStorage =
  Platform.OS === "web" ? WebStorageAdapter : LargeSecureStoreAdapter;

const SESSION_STORAGE_KEY = "toogether-auth-session";

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
    storageKey: SESSION_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// React Native has no global `Buffer`/`atob` to lean on, so JWT payloads are
// decoded by hand: base64url -> base64 -> raw bytes -> UTF-8 string.
const base64UrlDecode = (input: string) => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of base64) {
    const charValue = BASE64_CHARS.indexOf(char);
    if (charValue === -1) {
      continue;
    }
    buffer = (buffer << 6) | charValue;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes.push((buffer >> bitsCollected) & 0xff);
    }
  }

  return aesjs.utils.utf8.fromBytes(bytes);
};

// Reads whatever session is already on disk and decodes its JWT claims
// directly — no Supabase SDK call, no network involved, so it can never hang
// or be affected by a cold-start network race. Used to render the app as
// logged-in immediately on launch, before we've had a chance to verify/
// refresh the session with the server in the background.
export const getStoredSessionClaims = async (): Promise<{ sub: string; email?: string } | null> => {
  try {
    const raw = await authStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const accessToken: string | undefined = parsed?.access_token;
    if (!accessToken) {
      return null;
    }
    const payloadSegment = accessToken.split(".")[1];
    if (!payloadSegment) {
      return null;
    }
    const decoded = JSON.parse(base64UrlDecode(payloadSegment));
    if (!decoded?.sub) {
      return null;
    }
    return { sub: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
};
