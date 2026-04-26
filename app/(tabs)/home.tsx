import { AvatarBubble } from "@/components/AvatarBubble";
import { EventCard } from "@/components/EventCard";
import { HeaderHero } from "@/components/HeaderHero";
import { EventCardSkeleton } from "@/components/SkeletonLoaders/EventCardSkeleton";
import { useCreateEvent, useFeed } from "@/hooks/useFeed";
import { colors } from "@/lib/theme";
import type { EventCategory } from "@/lib/types";
import { useApp } from "@/providers/AppProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

const categories: {
  id: EventCategory | "all";
  label: string;
  emoji: string;
}[] = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "movies", label: "Movies", emoji: "🎬" },
  { id: "chill", label: "Chill", emoji: "☕" },
  { id: "music", label: "Music", emoji: "🎸" },
  { id: "sports", label: "Sports", emoji: "🏸" },
  { id: "travel", label: "Travel", emoji: "🚗" },
  { id: "food", label: "Food", emoji: "🍕" },
];

export default function HomeScreen() {
  const { currentUser } = useApp();
  const { data: events, isLoading } = useFeed();
  const { mutate: createEvent, isPending } = useCreateEvent();
  const [activeCategory, setActiveCategory] = useState<EventCategory | "all">(
    "all",
  );
  const [query, setQuery] = useState("");

  const filtered = events?.filter((event) => {
    const matchesCategory =
      activeCategory === "all" || event.category === activeCategory;
    const matchesSearch =
      !query ||
      event.title.toLowerCase().includes(query.toLowerCase()) ||
      event.location.toLowerCase().includes(query.toLowerCase());
    const matchesVisibility =
      !event.womenOnly ||
      currentUser?.gender === "woman" ||
      event.creatorId === currentUser?.id;
    return matchesCategory && matchesSearch && matchesVisibility;
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (isLoading)
    return (
      <>
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <HeaderHero
        title="Together"
        subtitle={`${greeting()}, ${currentUser?.name.split(" ")[0] ?? "there"}`}
        right={
          currentUser ? (
            <Pressable onPress={() => router.push("/(tabs)/profile")}>
              <AvatarBubble user={currentUser} size={42} />
            </Pressable>
          ) : null
        }
      >
        <View
          style={{
            marginTop: 20,
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <Ionicons name="search" size={18} color="#98A2B3" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search events or places"
            placeholderTextColor="#98A2B3"
            style={{ flex: 1, minHeight: 50, color: colors.text }}
          />
        </View>
      </HeaderHero>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 110 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {categories.map((category) => {
            const active = category.id === activeCategory;
            return (
              <Pressable
                key={category.id}
                onPress={() => setActiveCategory(category.id)}
                style={{
                  backgroundColor: active ? colors.primary : "#FFFFFF",
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text>{category.emoji}</Text>
                <Text
                  style={{
                    color: active ? "#FFFFFF" : colors.text,
                    fontWeight: "700",
                  }}
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
          {filtered?.length} {filtered?.length === 1 ? "plan" : "plans"}{" "}
          happening
        </Text>

        <View style={{ gap: 14 }}>
          {filtered?.length ? (
            filtered.map((event) => <EventCard key={event.id} event={event} />)
          ) : (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 28,
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 48 }}>🌙</Text>
              <Text
                style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}
              >
                No plans yet
              </Text>
              <Text style={{ color: colors.muted, textAlign: "center" }}>
                Try another category or create the first one.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
