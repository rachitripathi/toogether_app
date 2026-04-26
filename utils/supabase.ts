import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL! ||
  "https://najyegewtbeyigppuufy.supabase.co";
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY! ||
  "sb_publishable_pDw3N9foURXtQxbiTXt2aQ_Ylwziwcs";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars — check your .env file");
}

// Use AsyncStorage on mobile, localStorage on web
const getStorage = () => {
  if (Platform.OS === "web") return undefined; // uses localStorage automatically
  const AsyncStorage =
    require("@react-native-async-storage/async-storage").default;
  return AsyncStorage;
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Dev mock user — replace with real auth later
export const DEV_USER = {
  id: "dev-user-1234",
  name: "Test User",
  city: "Guwahati",
};
