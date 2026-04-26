import { FormField } from "@/components/FormField";
import { GradientButton } from "@/components/GradientButton";
import { colors } from "@/lib/theme";
import type { EventCategory } from "@/lib/types";
import { useApp } from "@/providers/AppProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const categories: { id: EventCategory; label: string; emoji: string }[] = [
  { id: "movies", label: "Movies", emoji: "🎬" },
  { id: "chill", label: "Chill", emoji: "☕" },
  { id: "music", label: "Music", emoji: "🎸" },
  { id: "sports", label: "Sports", emoji: "🏸" },
  { id: "food", label: "Food", emoji: "🍕" },
  { id: "travel", label: "Travel", emoji: "🚗" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "other", label: "Other", emoji: "✨" },
];

export default function CreateEventScreen() {
  const { createEvent, currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [maxPeople, setMaxPeople] = useState("");
  const [category, setCategory] = useState<EventCategory>("chill");
  const [womenOnly, setWomenOnly] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    setError("");
    if (!title || !date || !time || !location) {
      setError("Add title, date, time, and location.");
      return;
    }

    setIsLoading(true);
    try {
      const selectedCategory = categories.find((item) => item.id === category);

      // Parse dateTime and validate
      const dateTimeString = `${date}T${time}`;
      const parsedDate = new Date(dateTimeString);

      if (isNaN(parsedDate.getTime())) {
        setError("Invalid date or time format. Use YYYY-MM-DD and HH:MM");
        setIsLoading(false);
        return;
      }

      const eventData = {
        title,
        description,
        dateTime: parsedDate.toISOString(),
        location,
        maxPeople: maxPeople ? Number(maxPeople) : undefined,
        category,
        emoji: selectedCategory?.emoji ?? "✨",
        womenOnly,
      };

      console.log("Creating event with data:", eventData);
      const event = await createEvent(eventData);
      console.log("Event created:", event);

      router.replace(`/event/${event.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to create event: ${errorMessage}`);
      console.error("Error creating event:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.page,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
          Create a Plan
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 18,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
      >
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
            What&apos;s the vibe?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {categories.map((item) => {
              const active = item.id === category;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategory(item.id)}
                  style={{
                    width: "22%",
                    backgroundColor: active ? "#EEF2FF" : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: active ? "#C7D2FE" : colors.border,
                    borderRadius: 18,
                    paddingVertical: 14,
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                  <Text
                    style={{
                      color: active ? colors.primary : colors.muted,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FormField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Dune night at PVR"
        />
        <FormField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What's the plan? Set the vibe."
          multiline
        />
        <FormField
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="2026-04-15"
        />
        <FormField
          label="Time"
          value={time}
          onChangeText={setTime}
          placeholder="19:30"
        />
        <FormField
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="Where is it happening?"
        />
        <FormField
          label="Max People"
          value={maxPeople}
          onChangeText={setMaxPeople}
          keyboardType="numeric"
          placeholder="Leave empty for open"
        />

        {currentUser?.gender === "woman" ? (
          <Pressable
            onPress={() => setWomenOnly((value) => !value)}
            style={{
              backgroundColor: womenOnly ? "#FCE7F3" : "#FFFFFF",
              borderRadius: 18,
              borderWidth: 1,
              borderColor: womenOnly ? "#F9A8D4" : colors.border,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Women only
              </Text>
              <Text style={{ color: colors.muted }}>
                Only women should be able to view and request this plan.
              </Text>
            </View>
            <Ionicons
              name={womenOnly ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={womenOnly ? "#DB2777" : "#98A2B3"}
            />
          </Pressable>
        ) : null}

        {error ? (
          <View
            style={{
              backgroundColor: "#FEE2E2",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#FCA5A5",
            }}
          >
            <Text style={{ color: "#991B1B", fontWeight: "600" }}>{error}</Text>
          </View>
        ) : null}

        <GradientButton
          label={isLoading ? "Creating..." : "Drop the Plan"}
          onPress={handleCreate}
          fullWidth
          disabled={isLoading}
        />
      </ScrollView>
    </View>
  );
}
