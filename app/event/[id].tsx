import { AvatarBubble } from "@/components/AvatarBubble";
import { GradientButton } from "@/components/GradientButton";
import { EventDetailSkeleton } from "@/components/SkeletonLoaders/EventDetailSkeleton";
import { useEvent, useJoinRequest } from "@/hooks/useEvents";
import { colors } from "@/lib/theme";
import { useApp } from "@/providers/AppProvider";
import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
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

  //const event = getEventById(id ?? '');
  if (!isLoading && !event) {
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

  const creator = getUserById(event.creatorId);
  const isCreator = currentUser?.id === event.creatorId;
  const requestStatus = getRequestStatus(event.id);
  const pendingRequests = requests.filter(
    (request) => request.eventId === event.id && request.status === "pending",
  );
  const config = categoryConfig[event.category] ?? categoryConfig.other;
  const date = new Date(event.dateTime);
  const canViewWomenOnly =
    !event.womenOnly || currentUser?.gender === "woman" || isCreator;
  const canViewPrivateLayer = isCreator || requestStatus === "approved";
  const creatorRating = creator ? getUserAverageRating(creator.id) : null;
  const attendeeCount = event.approvedUserIds?.length + 1;
  const isFull = event.maxPeople ? attendeeCount >= event.maxPeople : false;

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
        <Text style={{ fontSize: 48 }}>🔒</Text>
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
      ? { bg: "#DCFCE7", text: "#15803D", label: "Approved member" }
      : requestStatus === "pending"
        ? { bg: "#FFF1D6", text: "#B45309", label: "Approval pending" }
        : requestStatus === "rejected"
          ? { bg: "#E5E7EB", text: "#6B7280", label: "Request declined" }
          : isCreator
            ? { bg: "#E0F2FE", text: colors.skyDark, label: "You are hosting" }
            : {
                bg: "#EEF2FF",
                text: colors.skyDark,
                label: "Open for requests",
              };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          backgroundColor: config.iconBackground,
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 24,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          gap: 18,
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
              onPress={() => router.push(`/chat/${event.id}`)}
              style={{
                backgroundColor: "#FFF1D6",
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: "#B45309", fontWeight: "800" }}>
                Open Chat
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Text style={{ fontSize: 54 }}>{event.emoji}</Text>
          <View style={{ flex: 1, gap: 8 }}>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#FFFFFF",
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: "row",
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: config.chipText,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {config.label}
              </Text>
              {event.womenOnly ? (
                <Text
                  style={{ color: "#BE185D", fontSize: 12, fontWeight: "700" }}
                >
                  Women only
                </Text>
              ) : null}
            </View>
            <Text
              style={{ fontSize: 28, fontWeight: "900", color: colors.text }}
            >
              {event.title}
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: statusTone.bg,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: statusTone.text,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {statusTone.label}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
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
            <Text style={{ color: colors.muted }}>{event.timeSlot}</Text>
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
              {event.maxPeople
                ? `${attendeeCount}/${event.maxPeople}`
                : attendeeCount}
            </Text>
            <Text style={{ color: colors.muted }}>
              {isFull
                ? "Plan is full"
                : event.maxPeople
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
            label={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} • ${event.timeSlot}`}
          />
          <InfoRow
            icon="location-outline"
            iconColor={colors.secondary}
            label={`${event.area}, Guwahati`}
          />
          {event.maxPeople ? (
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
                label={`Exact meeting time: ${event.exactTime}`}
              />
              <InfoRow
                icon="navigate"
                iconColor="#1D9E75"
                label={event.exactLocation}
              />
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

        {event.description ? (
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
              {event.description}
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

        {event.approvedUserIds?.length ? (
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
              Going ({event.approvedUserIds?.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {event.approvedUserIds?.map((userId: any) => {
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
                      onPress={() => rejectRequest(event.id, user.id)}
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
                      onPress={() => approveRequest(event.id, user.id)}
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
            <GradientButton
              label="Open Chat"
              onPress={() => router.push(`/chat/${event.id}`)}
              fullWidth
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
            <GradientButton
              label="Request to Join"
              onPress={() => requestToJoin(event.id)}
              fullWidth
            />
          )}
        </View>
      ) : null}
    </View>
  );
}
