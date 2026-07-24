import { AvatarBubble } from "@/components/AvatarBubble";
import { colors } from "@/lib/theme";
import type { User } from "@/lib/types";
import { useApp } from "@/providers/AppProvider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Gender = User["gender"];

const avatarPalettes = [
  ["#8B5CF6", "#6366F1"],
  ["#5BC4FF", "#16A34A"],
  ["#F5A623", "#FB7185"],
  ["#7C5CFF", "#FF5C6F"],
] as const;

const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, updateProfile } = useApp();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [username, setUsername] = useState(currentUser?.username ?? "");
  const [age, setAge] = useState(
    currentUser?.age ? String(currentUser.age) : "",
  );
  const [gender, setGender] = useState<Gender>(currentUser?.gender ?? "other");
  const [city, setCity] = useState(currentUser?.city ?? "");
  const [bio, setBio] = useState(currentUser?.bio ?? "");
  const [avatarColors, setAvatarColors] = useState<string[]>(
    currentUser?.avatarColors ?? ["#8B5CF6", "#6366F1"],
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewUser = useMemo<User | null>(() => {
    if (!currentUser) return null;
    return {
      ...currentUser,
      name: name.trim() || currentUser.name,
      username: username.trim() || currentUser.username,
      age: Number(age) || currentUser.age,
      gender,
      city: city.trim(),
      bio: bio.trim(),
      avatarColors,
    };
  }, [age, avatarColors, bio, city, currentUser, gender, name, username]);

  if (!currentUser || !previewUser) {
    return null;
  }

  const handleBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/profile"); // fallback route
  }
};

  const completionItems = [
    Boolean(name.trim()),
    usernamePattern.test(username.trim()),
    Boolean(age.trim()),
    Boolean(city.trim()),
    Boolean(bio.trim()),
  ];
  const completion = Math.round(
    (completionItems.filter(Boolean).length / completionItems.length) * 100,
  );

  const saveProfile = async () => {
   try {
     const parsedAge = Number(age);
    if (!name.trim()) {
      setError("Please add your name.");
      return;
    }
    if (!usernamePattern.test(username.trim())) {
      setError("Username must be 3-24 letters, numbers, or underscores.");
      return;
    }
    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setError("Please enter a valid age between 13 and 120.");
      return;
    }
    if (!city.trim()) {
      setError("Please add your city.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await updateProfile({
      name: name.trim(),
      username: username.trim(),
      age: parsedAge,
      gender,
      city: city.trim(),
      bio: bio.trim(),
      avatarColors,
    });

    setSaving(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    setMessage("Profile updated.");
    handleBack();
   } catch (error:any) {
    setError(error?.message || "Something went wrong!");
    console.log(error);

   } finally{
        setSaving(false);

   }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.page,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={handleBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
            Complete Profile
          </Text>
          <Text style={{ color: colors.muted, marginTop: 3 }}>
            {completion}% complete
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: Math.max(insets.bottom, 20) + 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <AvatarBubble user={previewUser} size={68} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
                {previewUser.name}
              </Text>
              <Text style={{ color: colors.muted }}>@{previewUser.username}</Text>
              <Text style={{ color: colors.skyDark, fontWeight: "700" }}>
                {previewUser.city || "Add your city"}
              </Text>
            </View>
          </View>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: "#EEF2F7" }}>
            <View
              style={{
                width: `${completion}%`,
                height: 8,
                borderRadius: 999,
                backgroundColor: colors.primary,
              }}
            />
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          <TextInput
            value={age}
            onChangeText={setAge}
            placeholder="Age"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            style={inputStyle}
          />
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Short bio"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={160}
            style={[inputStyle, { minHeight: 96, textAlignVertical: "top" }]}
          />
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "right" }}>
            {bio.length}/160
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            Gender
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["woman", "man", "other"] as Gender[]).map((item) => {
              const active = item === gender;
              return (
                <Pressable
                  key={item}
                  onPress={() => setGender(item)}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? colors.primary : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#FFFFFF" : colors.text,
                      fontWeight: "800",
                      textTransform: "capitalize",
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            Avatar Colors
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {avatarPalettes.map((palette) => {
              const active =
                palette[0] === avatarColors[0] && palette[1] === avatarColors[1];
              return (
                <Pressable
                  key={palette.join("-")}
                  onPress={() => setAvatarColors([...palette])}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: palette[0],
                    borderWidth: active ? 3 : 1,
                    borderColor: active ? colors.text : colors.border,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      marginLeft: "50%",
                      backgroundColor: palette[1],
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <Text style={{ color: colors.danger, textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
        {message ? (
          <Text style={{ color: colors.success, textAlign: "center" }}>
            {message}
          </Text>
        ) : null}

        <Pressable
          onPress={saveProfile}
          disabled={saving}
          style={{
            minHeight: 56,
            borderRadius: 24,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "900" }}>
              Save Profile
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const inputStyle = {
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 15,
  color: "#1F2937",
};
