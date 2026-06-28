import { useAuthContext } from "@/hooks/use-auth-context";
import {
  CATEGORY_CONFIG,
  MOCK_EVENTS,
  MOCK_MESSAGES,
  MOCK_RATINGS,
  MOCK_REQUESTS,
} from "@/lib/mockData";
import type {
  CrewRequest,
  Event,
  EventCategory,
  JoinRequest,
  Message,
  Rating,
  RequestStatus,
  User,
} from "@/lib/types";
import { supabase } from "@/utils/supabase";
import { createContext, useContext, useState, type ReactNode } from "react";

type CreateEventInput = {
  title: string;
  description: string;
  dateTime: string;
  area: string;
  timeSlot: "Morning" | "Afternoon" | "Evening" | "Night";
  exactTime: string;
  exactLocation: string;
  location: string;
  maxPeople?: number;
  category: EventCategory;
  emoji: string;
  womenOnly?: boolean;
};

type AppContextValue = {
  currentUser: User | null;
  events: Event[];
  requests: JoinRequest[];
  crewRequests: CrewRequest[];
  messages: Record<string, Message[]>;
  ratings: Rating[];
  isOnboardingComplete: boolean;
  shouldShowVerificationPrompt: boolean;
  categoryConfig: typeof CATEGORY_CONFIG;
  completeOnboarding: () => void;
  dismissVerificationPrompt: () => void;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  socialAuth: (provider: "google" | "apple", mode: "login" | "signup") => void;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<{ error: string | null }>;
  createEvent: (data: CreateEventInput) => Promise<Event>;
  requestToJoin: (eventId: string) => void;
  approveRequest: (eventId: string, userId: string) => void;
  rejectRequest: (eventId: string, userId: string) => void;
  inviteToEvent: (eventId: string, userId: string) => void;
  getRequestStatus: (eventId: string) => RequestStatus | null;
  sendCrewRequest: (userId: string) => void;
  acceptCrewRequest: (requestId: string) => void;
  rejectCrewRequest: (requestId: string) => void;
  getCrewStatus: (
    userId: string,
  ) => "none" | "pending_incoming" | "pending_outgoing" | "connected";
  getCrewMembers: () => User[];
  sendMessage: (eventId: string, text: string) => void;
  rateUser: (toUserId: string, eventId: string, stars: number) => void;
  getUserAverageRating: (userId: string) => number | null;
  getMyRatingForUser: (toUserId: string, eventId?: string) => number | null;
  getUserById: (id: string) => User | undefined | null;
  getEventById: (id: string) => Event | undefined;
  getEventsImPartOf: () => Event[];
  getInteractedUsers: () => User[];
};

const AppContext = createContext<AppContextValue | null>(null);

const getEmailName = (email: string) => email.split("@")[0] || "New user";
const getDefaultUsername = (email: string, userId: string) =>
  `${getEmailName(email).toLowerCase()}-${userId.slice(0, 8)}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile, refreshProfile } = useAuthContext();

  // Map Supabase profile → User shape
  const currentUser: User | null = profile
    ? {
      id: profile.id,
      email: profile.email ?? "",
      name: profile.name ?? profile.email?.split("@")[0] ?? "New user",
      username: profile.username ?? profile.email?.split("@")[0] ?? "",
      avatarColors: profile.avatar_colors ?? ["#8B5CF6", "#6366F1"],
      gender: profile.gender ?? "other",
      age: profile.age ?? 0,
      city: profile.city ?? "",
      verified: profile.verified ?? false,
      bio: profile.bio ?? "",
    }
    : null;

  const [events, setEvents] = useState(MOCK_EVENTS);
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [crewRequests, setCrewRequests] = useState<CrewRequest[]>([]);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [ratings, setRatings] = useState(MOCK_RATINGS);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [shouldShowVerificationPrompt, setShouldShowVerificationPrompt] =
    useState(true);

  const socialAuth = (
    _provider: "google" | "apple",
    _mode: "login" | "signup",
  ) => {
    // TODO: implement OAuth later
    console.log("Social auth not yet implemented");
  };
  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  };

  const signup = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.log(error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Email confirmation enabled
    if (!data.session) {
      return {
        success: true,
        requiresVerification: true,
        error: null,
      };
    }

    const userEmail = data.user?.email ?? email;

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: data.user!.id,
        email: userEmail,
        name: getEmailName(userEmail),
        username: getDefaultUsername(userEmail, data.user!.id),
      });

    if (profileError) {
      console.error("Profile creation failed:", profileError);

      return {
        success: false,
        accountCreated: true,
        error:
          "Your account was created, but profile setup failed. Please log in and try again.",
      };
    }

    return {
      success: true,
      error: null,
    };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Call this from your onboarding screen to fill in profile details
  const updateProfile = async (data: Partial<User>) => {
    if (!currentUser) return { error: "Not logged in" };
    const { error } = await supabase
      .from("profiles")
      .update({
        name: data.name,
        username: data.username,
        bio: data.bio,
        age: data.age,
        gender: data.gender,
        city: data.city,
        avatar_colors: data.avatarColors,
        verified: data.verified,
      })
      .eq("id", currentUser.id);
    if (!error) await refreshProfile();
    return { error: error?.message ?? null };
  };

  const completeOnboarding = () => setIsOnboardingComplete(true);
  const dismissVerificationPrompt = () =>
    setShouldShowVerificationPrompt(false);

  const createEvent = async (data: CreateEventInput): Promise<Event> => {
    if (!currentUser?.id) {
      throw new Error("User not authenticated");
    }

    const event: Event = {
      id: crypto.randomUUID(),
      creatorId: currentUser.id,
      approvedUserIds: [],
      requestUserIds: [],
      ...data,
    };

    setEvents((prev) => [event, ...prev]);

    try {
      const { data: insertedEvent, error } = await supabase
        .from("events")
        .insert([
          {
            id: event.id,
            creator_id: event.creatorId,
            title: event.title,
            description: event.description,
            date_time: event.dateTime,
            area: event.area,
            exact_time: event.exactTime,
            exact_location: event.exactLocation,
            time_slot: event.timeSlot,
            category: event.category,
            emoji: event.emoji,
            max_people: event.maxPeople || null,
            women_only: event.womenOnly ?? false,
            pinned: false,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        // Remove from optimistic state on failure
        setEvents((prev) => prev.filter((e) => e.id !== event.id));
        throw new Error(error.message);
      }

      // Update optimistic state with server response
      if (insertedEvent) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === event.id ? { ...event, ...insertedEvent } : e,
          ),
        );
      }
    } catch (err) {
      console.error("Error saving event:", err);
      // Remove from optimistic state on failure
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      throw err;
    }

    return event;
  };

  const requestToJoin = async (eventId: string) => {
    if (!currentUser) return;
    const existing = requests.find(
      (r) => r.eventId === eventId && r.userId === currentUser.id,
    );
    if (existing) return;
    const event = events.find((e) => e.id === eventId);
    if (event?.womenOnly && currentUser.gender !== "woman") return;
    if (event?.maxPeople && event.approvedUserIds.length + 1 >= event.maxPeople)
      return;

    const nextRequest: JoinRequest = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      eventId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    setRequests((prev) => [...prev, nextRequest]);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, requestUserIds: [...e.requestUserIds, currentUser.id] }
          : e,
      ),
    );

    try {
      const { error } = await supabase.from("join_requests").insert([
        {
          id: nextRequest.id,
          user_id: currentUser.id,
          event_id: eventId,
          status: "pending",
        },
      ]);
      if (error) throw error;
    } catch (err) {
      console.error("Error creating join request:", err);
      // Rollback optimistic update
      setRequests((prev) => prev.filter((r) => r.id !== nextRequest.id));
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
              ...e,
              requestUserIds: e.requestUserIds.filter(
                (id) => id !== currentUser.id,
              ),
            }
            : e,
        ),
      );
    }
  };

  const approveRequest = async (eventId: string, userId: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.eventId === eventId && r.userId === userId
          ? { ...r, status: "approved" }
          : r,
      ),
    );
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
            ...e,
            requestUserIds: e.requestUserIds.filter((id) => id !== userId),
            approvedUserIds: [...e.approvedUserIds, userId],
          }
          : e,
      ),
    );

    try {
      const { error } = await supabase
        .from("join_requests")
        .update({ status: "approved" })
        .eq("user_id", userId)
        .eq("event_id", eventId);
      if (error) throw error;
    } catch (err) {
      console.error("Error approving request:", err);
      // Rollback optimistic update
      setRequests((prev) =>
        prev.map((r) =>
          r.eventId === eventId && r.userId === userId
            ? { ...r, status: "pending" }
            : r,
        ),
      );
    }
  };

  const rejectRequest = async (eventId: string, userId: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.eventId === eventId && r.userId === userId
          ? { ...r, status: "rejected" }
          : r,
      ),
    );
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
            ...e,
            requestUserIds: e.requestUserIds.filter((id) => id !== userId),
          }
          : e,
      ),
    );

    try {
      const { error } = await supabase
        .from("join_requests")
        .update({ status: "rejected" })
        .eq("user_id", userId)
        .eq("event_id", eventId);
      if (error) throw error;
    } catch (err) {
      console.error("Error rejecting request:", err);
      // Rollback optimistic update
      setRequests((prev) =>
        prev.map((r) =>
          r.eventId === eventId && r.userId === userId
            ? { ...r, status: "pending" }
            : r,
        ),
      );
    }
  };

  const inviteToEvent = async (eventId: string, userId: string) => {
    const event = events.find((e) => e.id === eventId);
    if (!event || !currentUser) return;
    if (
      event.approvedUserIds.includes(userId) ||
      event.requestUserIds.includes(userId)
    )
      return;

    const inviteId = crypto.randomUUID();

    if (event.creatorId === currentUser.id) {
      // Creator directly approves
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, approvedUserIds: [...e.approvedUserIds, userId] }
            : e,
        ),
      );
      setRequests((prev) => [
        ...prev,
        {
          id: inviteId,
          eventId,
          userId,
          status: "approved",
          createdAt: new Date().toISOString(),
        },
      ]);

      try {
        const { error } = await supabase.from("join_requests").insert([
          {
            id: inviteId,
            user_id: userId,
            event_id: eventId,
            status: "approved",
          },
        ]);
        if (error) throw error;
      } catch (err) {
        console.error("Error creating approved invite:", err);
        // Rollback
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? {
                ...e,
                approvedUserIds: e.approvedUserIds.filter(
                  (id) => id !== userId,
                ),
              }
              : e,
          ),
        );
        setRequests((prev) => prev.filter((r) => r.id !== inviteId));
      }
      return;
    }

    // Non-creator sends pending invite
    setRequests((prev) => [
      ...prev,
      {
        id: inviteId,
        eventId,
        userId,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ]);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, requestUserIds: [...e.requestUserIds, userId] }
          : e,
      ),
    );

    try {
      const { error } = await supabase.from("join_requests").insert([
        {
          id: inviteId,
          user_id: userId,
          event_id: eventId,
          status: "pending",
        },
      ]);
      if (error) throw error;
    } catch (err) {
      console.error("Error creating pending invite:", err);
      // Rollback
      setRequests((prev) => prev.filter((r) => r.id !== inviteId));
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
              ...e,
              requestUserIds: e.requestUserIds.filter((id) => id !== userId),
            }
            : e,
        ),
      );
    }
  };

  const getRequestStatus = (eventId: string): RequestStatus | null => {
    if (!currentUser) return null;
    return (
      requests.find((r) => r.eventId === eventId && r.userId === currentUser.id)
        ?.status ?? null
    );
  };

  const sendCrewRequest = (userId: string) => {
    if (!currentUser || currentUser.id === userId) return;
    const existing = crewRequests.find(
      (r) =>
        ((r.fromUserId === currentUser.id && r.toUserId === userId) ||
          (r.fromUserId === userId && r.toUserId === currentUser.id)) &&
        r.status !== "rejected",
    );
    if (existing) return;
    setCrewRequests((prev) => [
      ...prev,
      {
        id: `c${Date.now()}`,
        fromUserId: currentUser.id,
        toUserId: userId,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const acceptCrewRequest = (requestId: string) => {
    setCrewRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "accepted" } : r)),
    );
  };

  const rejectCrewRequest = (requestId: string) => {
    setCrewRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "rejected" } : r)),
    );
  };

  const getCrewStatus = (userId: string) => {
    if (!currentUser) return "none" as const;
    const existing = crewRequests.find(
      (r) =>
        (r.fromUserId === currentUser.id && r.toUserId === userId) ||
        (r.fromUserId === userId && r.toUserId === currentUser.id),
    );
    if (!existing) return "none" as const;
    if (existing.status === "accepted") return "connected" as const;
    if (existing.toUserId === currentUser.id)
      return "pending_incoming" as const;
    return "pending_outgoing" as const;
  };

  const getCrewMembers = (): User[] => {
    // TODO: fetch real users from Supabase profiles table
    return [];
  };

  const sendMessage = (eventId: string, text: string) => {
    if (!currentUser || !text.trim()) return;
    const message: Message = {
      id: `m${Date.now()}`,
      eventId,
      userId: currentUser.id,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => ({
      ...prev,
      [eventId]: [...(prev[eventId] ?? []), message],
    }));
  };

  const rateUser = (toUserId: string, eventId: string, stars: number) => {
    if (!currentUser || currentUser.id === toUserId) return;
    setRatings((prev) => {
      const existingIndex = prev.findIndex(
        (r) =>
          r.fromUserId === currentUser.id &&
          r.toUserId === toUserId &&
          r.eventId === eventId,
      );
      const nextRating: Rating = {
        id: existingIndex >= 0 ? prev[existingIndex].id : `rt${Date.now()}`,
        fromUserId: currentUser.id,
        toUserId,
        eventId,
        stars,
        createdAt: new Date().toISOString(),
      };
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = nextRating;
        return updated;
      }
      return [...prev, nextRating];
    });
  };

  const getUserAverageRating = (userId: string) => {
    const userRatings = ratings.filter((r) => r.toUserId === userId);
    if (!userRatings.length) return null;
    return (
      userRatings.reduce((sum, r) => sum + r.stars, 0) / userRatings.length
    );
  };

  const getMyRatingForUser = (toUserId: string, eventId?: string) => {
    if (!currentUser) return null;
    return (
      ratings.find(
        (r) =>
          r.fromUserId === currentUser.id &&
          r.toUserId === toUserId &&
          (!eventId || r.eventId === eventId),
      )?.stars ?? null
    );
  };

  const getUserById = (id: string): User | null => {
    if (currentUser?.id === id) return currentUser;
    // TODO: fetch from Supabase profiles table for other users
    return null;
  };

  const getEventById = (id: string) => events.find((e) => e.id === id);

  const getEventsImPartOf = () => {
    if (!currentUser) return [];
    return events.filter((e) => {
      if (e.womenOnly && currentUser.gender !== "woman") return false;
      return (
        e.creatorId === currentUser.id ||
        e.approvedUserIds.includes(currentUser.id)
      );
    });
  };

  const getInteractedUsers = (): User[] => {
    // TODO: fetch from Supabase profiles table
    return [];
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        events,
        requests,
        crewRequests,
        messages,
        ratings,
        isOnboardingComplete,
        shouldShowVerificationPrompt,
        categoryConfig: CATEGORY_CONFIG,
        completeOnboarding,
        dismissVerificationPrompt,
        socialAuth,
        login,
        signup,
        logout,
        updateProfile,
        createEvent,
        requestToJoin,
        approveRequest,
        rejectRequest,
        inviteToEvent,
        getRequestStatus,
        sendCrewRequest,
        acceptCrewRequest,
        rejectCrewRequest,
        getCrewStatus,
        getCrewMembers,
        sendMessage,
        rateUser,
        getUserAverageRating,
        getMyRatingForUser,
        getUserById,
        getEventById,
        getEventsImPartOf,
        getInteractedUsers,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
