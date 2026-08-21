import { colors, gradients } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

type ResetStep = "request" | "otp";

const API_BASE_URL = process.env.EXPO_PUBLIC_FORGOT_PASSWORD_API_URL ?? "";
const RESEND_COOLDOWN_S = 60;

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok && data.ok !== false, data };
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState(params.email ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
    };
  }, []);

  const startResendCooldown = () => {
    setResendIn(RESEND_COOLDOWN_S);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendIn((value) => {
        if (value <= 1 && resendTimer.current) {
          clearInterval(resendTimer.current);
        }
        return Math.max(0, value - 1);
      });
    }, 1000);
  };

  const sendOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    await postJson("/api/forgot-password/send-otp", { email: email.trim() });

    setLoading(false);
    setStep("otp");
    startResendCooldown();
    setMessage("If that email has an account, a 6-digit code was sent to it.");
  };

  const resendOtp = async () => {
    if (resendIn > 0) return;
    setError(null);
    await postJson("/api/forgot-password/send-otp", { email: email.trim() });
    startResendCooldown();
    setMessage("Code resent. Check your email.");
  };

  const verifyOtp = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { ok, data } = await postJson("/api/forgot-password/verify-otp", {
      email: email.trim(),
      otp: otp.trim(),
      newPassword: password,
    });

    setLoading(false);

    if (!ok) {
      setError(data?.error ?? "Invalid or expired code.");
      return;
    }

    setDone(true);
    setMessage("Password updated. You can now log in with your new password.");
  };

  const isOtpStep = step === "otp";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
            onPress={() =>
              isOtpStep && !done ? setStep("request") : router.replace("/auth")
            }
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
              {isOtpStep ? "Enter your code and a new password." : "Recover your account."}
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
          {!isOtpStep ? (
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
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: "#1F2937",
                }}
              />
              <Text style={{ color: colors.muted, lineHeight: 21 }}>
                We will email you a 6-digit code to reset your password.
              </Text>
            </>
          ) : (
            <>
              <TextInput
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
                editable={!done}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 20,
                  letterSpacing: 6,
                  color: "#1F2937",
                  textAlign: "center",
                }}
              />

              {!done ? (
                <Pressable
                  onPress={resendOtp}
                  disabled={resendIn > 0}
                  style={{ alignItems: "center", paddingVertical: 4 }}
                >
                  <Text
                    style={{
                      color: resendIn > 0 ? colors.muted : colors.skyDark,
                      fontWeight: "800",
                      fontSize: 13,
                    }}
                  >
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                  </Text>
                </Pressable>
              ) : null}

              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
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
                  editable={!done}
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
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
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
                  editable={!done}
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

          {!done ? (
            <Pressable
              onPress={isOtpStep ? verifyOtp : sendOtp}
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
                  {isOtpStep ? "Update Password" : "Send Code"}
                </Text>
              )}
            </Pressable>
          ) : null}

          {done ? (
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
