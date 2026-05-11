import { AvatarBubble } from "@/components/AvatarBubble";
import { EventDetailSkeleton } from "@/components/SkeletonLoaders/EventDetailSkeleton";
import { useEvent, useJoinRequest } from "@/hooks/useEvents";
import { colors } from "@/lib/theme";
import { categoryFontFamily, categoryVisuals, type CategoryVisualTheme } from "@/lib/categoryVisuals";
import { useApp } from "@/providers/AppProvider";
import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ImageBackground, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCollapsibleHeader } from "@/hooks/useCollapsibleHeader";

function InfoRow({
  icon,
  iconColor,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

function ThemedActionButton({
  label,
  onPress,
  visual,
}: {
  label: string;
  onPress: () => void;
  visual: CategoryVisualTheme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 56,
        borderRadius: 28,
        backgroundColor: visual.buttonBackground,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: visual.buttonShadow,
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 7 },
        elevation: 4,
      }}
    >
      <Text style={{ color: visual.buttonText, fontSize: 16, fontWeight: "900", fontFamily: categoryFontFamily }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const { collapsed, onScroll } = useCollapsibleHeader();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading } = useEvent(id as string);
  const { mutate: sendJoinRequest, isPending } = useJoinRequest();
  const user = useAuthStore((s) => s.user);
  const {
    currentUser,
    getEventById,
    getUserById,
    getUserAverageRating,
    requestToJoin,
    getRequestStatus,
    approveRequest,
    rejectRequest,
    requests,
    categoryConfig,
  } = useApp();

  // Use Supabase event data if available, fallback to context
  const contextEvent = getEventById(id ?? '');
  const displayEvent = event || contextEvent;

  if (!isLoading && !displayEvent) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.page,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "800" }}>
          Event not found
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return <EventDetailSkeleton />;
  }

  const creator = getUserById(displayEvent.creatorId);
  const isCreator = currentUser?.id === displayEvent.creatorId;
  const requestStatus = getRequestStatus(displayEvent.id);
  const pendingRequests = requests.filter(
    (request) => request.eventId === displayEvent.id && request.status === "pending",
  );
  const config = categoryConfig[displayEvent.category] ?? categoryConfig.other;
  const visual = categoryVisuals[displayEvent.category] ?? categoryVisuals.other;
  const date = new Date(displayEvent.dateTime);
  const canViewWomenOnly =
    !displayEvent.womenOnly || currentUser?.gender === "woman" || isCreator;
  const canViewPrivateLayer = isCreator || requestStatus === "approved";
  const mapUrl =
    displayEvent.mapUrl ??
    (displayEvent.latitude && displayEvent.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${displayEvent.latitude},${displayEvent.longitude}`
      : undefined);
  const creatorRating = creator ? getUserAverageRating(creator.id) : null;
  const attendeeCount = displayEvent.approvedUserIds?.length + 1;
  const isFull = displayEvent.maxPeople ? attendeeCount >= displayEvent.maxPeople : false;

  if (!canViewWomenOnly) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.page,
          padding: 24,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: "800",
            marginTop: 12,
          }}
        >
          Women-only plan
        </Text>
        <Text
          style={{ color: colors.muted, textAlign: "center", marginTop: 8 }}
        >
          This plan is only visible to women participants.
        </Text>
      </View>
    );
  }

  const statusTone =
    requestStatus === "approved"
      ? { bg: "#DCFCE7", text: "#15803D", label: "Approved member", shadow: "#84CC96" }
      : requestStatus === "pending"
        ? { bg: "#FFBE3D", text: "#5B3A00", label: "Approval pending", shadow: "#D4860F" }
        : requestStatus === "rejected"
          ? { bg: "#E5E7EB", text: "#6B7280", label: "Request declined", shadow: "#B8C0CC" }
          : isCreator
            ? { bg: visual.buttonBackground, text: visual.buttonText, label: "You are hosting", shadow: visual.buttonShadow }
            : { bg: visual.buttonBackground, text: visual.buttonText, label: "Open for requests", shadow: visual.buttonShadow };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ImageBackground
        source={visual.background}
        resizeMode="cover"
        imageStyle={{
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: collapsed ? 16 : 24,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          gap: collapsed ? 12 : 18,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.75)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          {isCreator || requestStatus === "approved" ? (
            <Pressable
              onPress={() => router.push(`/chat/${displayEvent.id}`)}
              style={{
                backgroundColor: visual.buttonBackground,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 10,
                shadowColor: visual.buttonShadow,
                shadowOpacity: 0.26,
                shadowRadius: 9,
                shadowOffset: { width: 0, height: 5 },
                elevation: 3,
              }}
            >
              <Text style={{ color: visual.buttonText, fontWeight: "900", fontFamily: categoryFontFamily }}>Open Chat</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Text style={{ fontSize: collapsed ? 38 : 54 }}>{displayEvent.emoji}</Text>
          <View style={{ flex: 1, gap: 8 }}>
            {!collapsed ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: visual.chipBackground,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                <Text style={{ color: visual.chipText, fontSize: 12, fontWeight: "800", fontFamily: categoryFontFamily }}>{config.label}</Text>
                {displayEvent.womenOnly ? (
                  <Text style={{ color: "#BE185D", fontSize: 12, fontWeight: "700" }}>Women only</Text>
                ) : null}
              </View>
            ) : null}
            <Text style={{ fontSize: collapsed ? 22 : 28, fontWeight: "900", color: visual.title, fontFamily: categoryFontFamily }}>{displayEvent.title}</Text>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: statusTone.bg,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
                shadowColor: statusTone.shadow,
                shadowOpacity: 0.2,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
            >
              <Text style={{ color: statusTone.text, fontSize: 12, fontWeight: "900", fontFamily: categoryFontFamily }}>{statusTone.label}</Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 140 }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#FFFFFF",
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 5,
            }}
          >
            <Text
              style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}
            >
              Schedule
            </Text>
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              {date.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Text>
            <Text style={{ color: colors.muted }}>{displayEvent.timeSlot}</Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: "#FFFFFF",
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 5,
            }}
          >
            <Text
              style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}
            >
              Attendance
            </Text>
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              {displayEvent.maxPeople
                ? `${attendeeCount}/${displayEvent.maxPeople}`
                : attendeeCount}
            </Text>
            <Text style={{ color: colors.muted }}>
              {isFull
                ? "Plan is full"
                : displayEvent.maxPeople
                  ? "Spots still open"
                  : "Open-size hangout"}
            </Text>
          </View>
        </View>

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
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            Plan snapshot
          </Text>
          <InfoRow
            icon="time-outline"
            iconColor={colors.primary}
            label={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} • ${displayEvent.timeSlot}`}
          />
          <InfoRow
            icon="location-outline"
            iconColor={colors.secondary}
            label={`${displayEvent.area}, Guwahati`}
          />
          {displayEvent.locationNote ? (
            <InfoRow icon="information-circle-outline" iconColor="#16A34A" label={displayEvent.locationNote} />
          ) : null}
          {displayEvent.maxPeople ? (
            <InfoRow
              icon="people-outline"
              iconColor="#16A34A"
              label={`${attendeeCount} going so far`}
            />
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            gap: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}
            >
              Private details
            </Text>
            <View
              style={{
                backgroundColor: canViewPrivateLayer ? "#DCFCE7" : "#EEF2F7",
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: canViewPrivateLayer ? "#15803D" : colors.muted,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {canViewPrivateLayer ? "Unlocked" : "Locked"}
              </Text>
            </View>
          </View>
          {canViewPrivateLayer ? (
            <View style={{ gap: 10 }}>
              <InfoRow
                icon="time"
                iconColor="#1D9E75"
                label={`Exact meeting time: ${displayEvent.exactTime}`}
              />
              <InfoRow
                icon="navigate"
                iconColor="#1D9E75"
                label={displayEvent.exactLocation}
              />
              {mapUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(mapUrl)}
                  style={{
                    backgroundColor: "#E0F2FE",
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Ionicons name="map-outline" size={20} color={colors.skyDark} />
                    <Text style={{ color: colors.skyDark, fontWeight: "800" }}>Open pinned location in Maps</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.skyDark} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Exact address and time unlock after the host approves your join
                request.
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                This keeps spontaneous plans safer while still letting people
                discover them publicly.
              </Text>
            </View>
          )}
        </View>

        {displayEvent.description ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 18,
              gap: 10,
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}
            >
              About
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 22 }}>
              {displayEvent.description}
            </Text>
          </View>
        ) : null}

        {creator ? (
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
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}
            >
              Hosted by
            </Text>
            <Pressable
              onPress={() => router.push(`/user/${creator.id}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <AvatarBubble user={creator} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  {creator.name}
                </Text>
                <Text style={{ color: colors.muted }}>@{creator.username}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {creator.age} •{" "}
                  {creatorRating ? `${creatorRating.toFixed(1)}★ karma` : "New"}
                  {creator.verified ? " • Verified" : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
            </Pressable>
          </View>
        ) : null}

        {displayEvent.approvedUserIds?.length ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 18,
              gap: 12,
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}
            >
              Going ({displayEvent.approvedUserIds?.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {displayEvent.approvedUserIds?.map((userId: any) => {
                const user = getUserById(userId);
                if (!user) return null;
                return (
                  <Pressable
                    key={userId}
                    onPress={() => router.push(`/user/${userId}`)}
                    style={{
                      backgroundColor: colors.page,
                      borderRadius: 999,
                      padding: 8,
                      paddingRight: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <AvatarBubble user={user} size={28} />
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {user.name.split(" ")[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {isCreator ? (
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
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}
            >
              Join Requests{" "}
              {pendingRequests?.length ? `(${pendingRequests?.length})` : ""}
            </Text>
            {pendingRequests?.length ? (
              pendingRequests?.map((request) => {
                const user = getUserById(request.userId);
                if (!user) return null;
                return (
                  <View
                    key={request.id}
                    style={{
                      backgroundColor: "#F8FAFC",
                      borderRadius: 18,
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <AvatarBubble user={user} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        {user.name}
                      </Text>
                      <Text style={{ color: colors.muted }}>
                        @{user.username} •{" "}
                        {user.verified ? "Verified" : "Unverified"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => rejectRequest(displayEvent.id, user.id)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#FFE4E6",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="close" size={18} color={colors.danger} />
                    </Pressable>
                    <Pressable
                      onPress={() => approveRequest(displayEvent.id, user.id)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#DCFCE7",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#16A34A" />
                    </Pressable>
                  </View>
                );
              })
            ) : (
              <Text style={{ color: colors.muted }}>
                No pending requests right now.
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      {!isCreator ? (
        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: Math.max(insets.bottom, 16) + 12,
          }}
        >
          {requestStatus === "approved" ? (
            <ThemedActionButton
              label="Open Chat"
              onPress={() => router.push(`/chat/${displayEvent.id}`)}
              visual={visual}
            />
          ) : requestStatus === "pending" ? (
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: 24,
                paddingVertical: 18,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#B45309", fontWeight: "800" }}>
                Request Pending
              </Text>
            </View>
          ) : requestStatus === "rejected" ? (
            <View
              style={{
                backgroundColor: "#E5E7EB",
                borderRadius: 24,
                paddingVertical: 18,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#6B7280", fontWeight: "800" }}>
                Not this time
              </Text>
            </View>
          ) : isFull ? (
            <View
              style={{
                backgroundColor: "#E5E7EB",
                borderRadius: 24,
                paddingVertical: 18,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#6B7280", fontWeight: "800" }}>
                This plan is full
              </Text>
            </View>
          ) : (
            <ThemedActionButton
              label="Request to Join"
              onPress={() => requestToJoin(displayEvent.id)}
              visual={visual}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}
