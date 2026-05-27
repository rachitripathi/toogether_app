//this is new home screen with new feed implementation using supabase, old one is archived in home.old.tsx
import { AvatarBubble } from "@/components/AvatarBubble";
import { EventCard } from "@/components/EventCard";
import { HeaderHero } from "@/components/HeaderHero";
import { PinMark } from "@/components/PinMark";
import { EventCardSkeleton } from "@/components/SkeletonLoaders/EventCardSkeleton";
import { useCreateEvent, useFeed } from "@/hooks/useEvents";
import { colors, shadow } from "@/lib/theme";
import type { EventCategory } from "@/lib/types";
import { useApp } from "@/providers/AppProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  { id: "food", label: "Food", emoji: "🍔" },
  { id: "travel", label: "Drives", emoji: "🚗" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "other", label: "Other", emoji: "✨" },
];

function SearchBar({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (value: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: colors.page,
        paddingHorizontal: 20,
        paddingTop: Math.max(insets.top - 28, 4),
        paddingBottom: 10,
      }}
    >
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.primary,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          gap: 10,
          shadowColor: "#D7E8FF",
          shadowOpacity: 0.16,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 1,
        }}
      >
        <Ionicons name="search" size={18} color="#9C9AA4" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search hangouts or areas"
          placeholderTextColor="#A6A2A8"
          style={{
            flex: 1,
            minHeight: 52,
            color: colors.text,
            fontSize: 14,
            fontWeight: "600",
          }}
        />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { currentUser, events } = useApp();
  const { data: supabaseEvents, isLoading } = useFeed();
  const { mutate: createEvent, isPending } = useCreateEvent();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<EventCategory | "all">(
    "all",
  );
  const [query, setQuery] = useState("");

  // Use Supabase events if available, fallback to context events
  const displayEvents = supabaseEvents ?? events ?? [];

  const filtered = displayEvents.filter((event: any) => {
    const normalizedQuery = query.toLowerCase();
    const matchesCategory =
      activeCategory === "all" || event.category === activeCategory;
    const matchesSearch =
      !query ||
      event.title.toLowerCase().includes(normalizedQuery) ||
      event.area.toLowerCase().includes(normalizedQuery) ||
      event.locationNote?.toLowerCase().includes(normalizedQuery);
    const matchesVisibility =
      !event.womenOnly ||
      currentUser?.gender === "woman" ||
      event.creatorId === currentUser?.id;
    return matchesCategory && matchesSearch && matchesVisibility;
  });

  const pinnedCount = filtered.filter((event: any) => event.pinned).length;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 154 }}
        showsVerticalScrollIndicator={false}
      >
        <HeaderHero
          eyebrow={`Hey ${currentUser?.name?.split(" ")[0] ?? "there"} 👋`}
          title="What's the plan?"
          onTitlePress={() => router.push("/(tabs)/profile")}
          leading={
            currentUser ? (
              <Pressable onPress={() => router.push("/(tabs)/profile")}>
                <AvatarBubble user={currentUser} size={46} />
              </Pressable>
            ) : null
          }
          right={
            <Pressable
              onPress={() => router.push("/verification")}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "#111111",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={
                  currentUser?.verified
                    ? "checkmark"
                    : "shield-checkmark-outline"
                }
                size={18}
                color="#FFD700"
              />
            </Pressable>
          }
        />

        <SearchBar query={query} setQuery={setQuery} />

        <View style={{ paddingHorizontal: 20, gap: 18, paddingTop: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
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
                    paddingLeft: 8,
                    paddingRight: 16,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    shadowColor: active ? "#B7DBFF" : "#DCE4F0",
                    shadowOpacity: active ? 0.2 : 0.16,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: active ? 3 : 2,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: "#FFFFFF",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{category.emoji}</Text>
                  </View>
                  <Text
                    style={{
                      color: active ? "#FFFFFF" : colors.text,
                      fontWeight: "800",
                    }}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ gap: 4 }}>
            <Text
              style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}
            >
              {filtered.length} {filtered.length === 1 ? "plan" : "plans"}{" "}
              happening
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={{ color: colors.muted, fontSize: 14, flex: 1 }}>
                {activeCategory === "all"
                  ? "Best nearby options right now."
                  : `Showing ${categories.find((item) => item.id === activeCategory)?.label?.toLowerCase()} plans.`}
              </Text>
              {pinnedCount ? <PinMark size={14} /> : null}
            </View>
          </View>

          <View style={{ gap: 16 }}>
            {filtered.length ? (
              filtered.map((event: any) => (
                <EventCard key={event.id} event={event} />
              ))
            ) : (
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 28,
                  padding: 28,
                  alignItems: "center",
                  gap: 10,
                  ...shadow.card,
                }}
              >
                <Text style={{ fontSize: 48 }}>🌙</Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: "800",
                  }}
                >
                  No plans in this filter
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    textAlign: "center",
                    lineHeight: 22,
                  }}
                >
                  Try another category or clear your search. If nothing fits,
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating create button — restored from old screen */}
      <Pressable
        onPress={() => router.push("/create-event")}
        style={{
          position: "absolute",
          right: 20,
          bottom: Math.max(insets.bottom, 12) + 18,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          ...shadow.lift,
        }}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
