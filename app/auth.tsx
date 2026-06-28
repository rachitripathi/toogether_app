import { colors, gradients } from "@/lib/theme";
import { useApp } from "@/providers/AppProvider";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { socialAuth, login, signup } = useApp();
  const insets = useSafeAreaInsets();

  const handleSocialAuth = (provider: "google" | "apple") => {
    socialAuth(provider, mode);
    // router.replace('/(tabs)/home') will be added once OAuth is implemented
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error } =
      mode === "login"
        ? await login(email.trim(), password)
        : await signup(email.trim(), password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    router.replace("/(tabs)/home");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <LinearGradient colors={[...gradients.hero]} style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: insets.top + 22,
            paddingBottom: 28,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: "900" }}>
            Toogether
          </Text>
          <Text
            style={{
              color: colors.skyDark,
              marginTop: 8,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Your next plan is one tap away.
          </Text>
        </View>

        <ScrollView
          style={{
            flex: 1,
            backgroundColor: colors.page,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }}
          contentContainerStyle={{
            padding: 24,
            gap: 16,
            paddingBottom: Math.max(insets.bottom, 16) + 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mode toggle */}
          <View
            style={{
              backgroundColor: "#EEF2F7",
              borderRadius: 18,
              padding: 4,
              flexDirection: "row",
            }}
          >
            {(["login", "signup"] as Mode[]).map((item) => {
              const active = item === mode;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setMode(item);
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    backgroundColor: active ? "#FFFFFF" : "transparent",
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#1A1A2E" : "#7A8093",
                      fontWeight: "800",
                    }}
                  >
                    {item === "login" ? "Log In" : "Sign Up"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Email input */}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: "#F9FAFB",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 15,
              color: "#1F2937",
            }}
          />

          {/* Password input */}
          <View
            style={{
              backgroundColor: "#F9FAFB",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              flexDirection: "row",
              alignItems: "center",
              paddingRight: 12,
            }}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              style={{
                flex: 1,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: "#1F2937",
              }}
            />
            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#7A8093"
              />
            </Pressable>
          </View>

          {mode === "login" ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/reset-password",
                  params: email.trim() ? { email: email.trim() } : undefined,
                })
              }
              style={{ alignSelf: "flex-end", paddingVertical: 2 }}
            >
              <Text style={{ color: colors.skyDark, fontWeight: "800" }}>
                Forgot password?
              </Text>
            </Pressable>
          ) : null}

          {/* Error message */}
          {error && (
            <Text
              style={{ color: "#EF4444", fontSize: 13, textAlign: "center" }}
            >
              {error}
            </Text>
          )}

          {/* Email/password submit */}
          <Pressable
            onPress={handleEmailAuth}
            disabled={loading}
            style={{
              minHeight: 56,
              borderRadius: 24,
              backgroundColor: colors.primary ?? "#6366F1",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}
              >
                {mode === "login" ? "Log In" : "Create Account"}
              </Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
            <Text style={{ color: "#9CA3AF", fontSize: 13 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
          </View>

          {/* Google — stub for now */}
          <Pressable
            onPress={() => handleSocialAuth("google")}
            disabled
            style={{
              minHeight: 56,
              borderRadius: 24,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              opacity: 0.5,
            }}
          >
            <Ionicons name="logo-google" size={18} color="#EA4335" />
            <Text style={{ color: "#1F2937", fontSize: 16, fontWeight: "800" }}>
              {mode === "login"
                ? "Continue with Google"
                : "Sign up with Google"}
            </Text>
          </Pressable>

          {/* Apple — stub for now */}
          <Pressable
            onPress={() => handleSocialAuth("apple")}
            disabled
            style={{
              minHeight: 56,
              borderRadius: 24,
              backgroundColor: "#111827",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
              opacity: 0.5,
            }}
          >
            <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
              {mode === "login" ? "Continue with Apple" : "Sign up with Apple"}
            </Text>
          </Pressable>

          <Text style={{ color: "#98A2B3", fontSize: 12, textAlign: "center" }}>
            Google and Apple sign-in coming soon. For women-only plans, gender
            is confirmed from your profile after sign-in.
          </Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
