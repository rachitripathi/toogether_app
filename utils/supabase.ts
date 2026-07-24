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

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: ExpoWebSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
