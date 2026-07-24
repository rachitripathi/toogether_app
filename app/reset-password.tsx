import { colors, gradients } from "@/lib/theme";
import { supabase } from "@/utils/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLinking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

type ResetStep = "request" | "update";

const getWebResetUrl = () =>
  typeof window !== "undefined"
    ? `${window.location.origin}/reset-password`
    : null;

const getResetRedirectUrl = () =>
  Platform.OS === "web"
    ? (getWebResetUrl() ?? "toogetherexpo://reset-password")
    : ExpoLinking.createURL("/reset-password");

const getUrlParams = (url: string | null) => {
  const params = new URLSearchParams();
  if (!url) return params;

  const [, query = ""] = url.split("?");
  const [cleanQuery = ""] = query.split("#");
  const [, hash = ""] = url.split("#");

  new URLSearchParams(cleanQuery).forEach((value, key) =>
    params.set(key, value),
  );
  new URLSearchParams(hash).forEach((value, key) => params.set(key, value));

  return params;
};

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);

  const redirectUrl = useMemo(getResetRedirectUrl, []);

  useEffect(() => {
    const prepareRecoverySession = async () => {
      setCheckingLink(true);

      const initialUrl =
        Platform.OS === "web" && typeof window !== "undefined"
          ? window.location.href
          : await ExpoLinking.getInitialURL();
      const urlParams = getUrlParams(initialUrl);
      const code = urlParams.get("code");
      const accessToken = urlParams.get("access_token");
      const refreshToken = urlParams.get("refresh_token");
      const type = urlParams.get("type");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
        } else {
          setStep("update");
        }
      } else if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          setError(sessionError.message);
        } else {
          setStep("update");
        }
      } else if (type === "recovery") {
        const { data } = await supabase.auth.getSession();
        if (data.session) setStep("update");
      }

      setCheckingLink(false);
    };

    prepareRecoverySession();
  }, []);

  const sendResetEmail = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: redirectUrl },
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Password reset link sent. Check your email and open the link.");
  };

  const updatePassword = async () => {
    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Password updated. You can now log in with your new password.");
    setPassword("");
    setConfirmPassword("");
  };

  const isUpdateStep = step === "update";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <LinearGradient colors={[...gradients.hero]} style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: insets.top + 18,
            paddingBottom: 24,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Pressable
            onPress={() => router.replace("/auth")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          <View>
            <Text
              style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}
            >
              Reset Password
            </Text>
            <Text style={{ color: colors.skyDark, marginTop: 4 }}>
              {isUpdateStep ? "Choose a new password." : "Recover your account."}
            </Text>
          </View>
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
          {checkingLink ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : isUpdateStep ? (
            <>
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
                  placeholder="New password"
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
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#7A8093"
                  />
                </Pressable>
              </View>
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
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPassword}
                  style={{
                    flex: 1,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 15,
                    color: "#1F2937",
                  }}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword((value) => !value)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={20}
                    color="#7A8093"
                  />
                </Pressable>
              </View>
            </>
          ) : (
            <>
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
              <Text style={{ color: colors.muted, lineHeight: 21 }}>
                We will send a secure link to this email. Open it to set a new
                password.
              </Text>
            </>
          )}

          {error ? (
            <Text style={{ color: "#EF4444", fontSize: 13, textAlign: "center" }}>
              {error}
            </Text>
          ) : null}
          {message ? (
            <Text style={{ color: colors.success, fontSize: 13, textAlign: "center" }}>
              {message}
            </Text>
          ) : null}

          {!checkingLink ? (
            <Pressable
              onPress={isUpdateStep ? updatePassword : sendResetEmail}
              disabled={loading}
              style={{
                minHeight: 56,
                borderRadius: 24,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}
                >
                  {isUpdateStep ? "Update Password" : "Send Reset Link"}
                </Text>
              )}
            </Pressable>
          ) : null}

          {message && isUpdateStep ? (
            <Pressable
              onPress={() => router.replace("/auth")}
              style={{ alignItems: "center", paddingVertical: 6 }}
            >
              <Text style={{ color: colors.skyDark, fontWeight: "800" }}>
                Back to login
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
