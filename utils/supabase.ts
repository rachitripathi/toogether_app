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

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
