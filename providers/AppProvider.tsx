import {
  CATEGORY_CONFIG,
  MOCK_EVENTS,
  MOCK_MESSAGES,
  MOCK_RATINGS,
  MOCK_REQUESTS,
  MOCK_USERS,
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
import {
  createContext,
  useContext,
  useState,
  type ReactNode
} from "react";

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

type SocialProvider = "google" | "apple";

type AppContextValue = {
  currentUser: User | null;
  users: User[];
  events: Event[];
  requests: JoinRequest[];
  crewRequests: CrewRequest[];
  messages: Record<string, Message[]>;
  ratings: Rating[];
  isOnboardingComplete: boolean;
  shouldShowVerificationPrompt: boolean;
  categoryConfig: typeof CATEGORY_CONFIG;
  completeOnboarding: () => void;
  socialAuth: (provider: SocialProvider, mode: "login" | "signup") => void;
  logout: () => void;
  dismissVerificationPrompt: () => void;
  createEvent: (data: CreateEventInput) => Event;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [users] = useState(MOCK_USERS);
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [crewRequests, setCrewRequests] = useState<CrewRequest[]>([
    {
      id: "c1",
      fromUserId: "u2",
      toUserId: "u1",
      status: "accepted",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "c2",
      fromUserId: "u4",
      toUserId: "u1",
      status: "pending",
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [ratings, setRatings] = useState(MOCK_RATINGS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [shouldShowVerificationPrompt, setShouldShowVerificationPrompt] =
    useState(false);

  const socialAuth = (provider: SocialProvider, mode: "login" | "signup") => {
    if (provider === "google") {
      const existing = users.find((item) => item.id === "u2");
      if (existing) {
        setCurrentUser(existing);
        setShouldShowVerificationPrompt(false);
        return;
      }
    }

    if (provider === "apple") {
      const nextUser = {
        id: "u6",
        name: "Aisha Thomas",
        email: "aisha@example.com",
        username: "aishat",
        avatarColors: ["#A78BFA", "#38BDF8"],
        gender: "woman",
        age: 25,
        city: "Guwahati",
        verified: true,
        bio:
          mode === "signup"
            ? "New here and ready for plans."
            : "Always down for one good plan.",
      };
      setCurrentUser(nextUser);
      setShouldShowVerificationPrompt(false);
      return;
    }

    const nextUser = {
      id: "u1",
      name: "Aryan Shah",
      email: "aryan@example.com",
      username: "aryanshah",
      avatarColors: ["#8B5CF6", "#6366F1"],
      gender: "man",
      age: 23,
      city: "Guwahati",
      verified: false,
      bio: "Living for spontaneous plans.",
    };
    setCurrentUser(nextUser);
    setShouldShowVerificationPrompt(!nextUser.verified);
  };

  const logout = () => {
    setCurrentUser(null);
    setShouldShowVerificationPrompt(false);
  };

  const completeOnboarding = () => {
    setIsOnboardingComplete(true);
  };

  const dismissVerificationPrompt = () => {
    setShouldShowVerificationPrompt(false);
  };

  const createEvent = async (data: CreateEventInput) => {
    const event: Event = {
      id: `e${Date.now()}`,
      creatorId: currentUser?.id ?? "u1",
      approvedUserIds: [],
      requestUserIds: [],
      ...data,
    };

    console.log("Created event object:", JSON.stringify(event, null, 2));

    // Save to local state immediately
    setEvents((prev) => {
      const updated = [event, ...prev];
      console.log("Updated events state, total events:", updated.length);
      return updated;
    });

    // Attempt to save to Supabase (non-blocking)
    try {
      const { error } = await supabase.from("events").insert([
        {
          id: event.id,
          creator_id: event.creatorId,
          title: event.title,
          description: event.description,
          date_time: event.dateTime,
          location: event.location,
          max_people: event.maxPeople,
          category: event.category,
          emoji: event.emoji,
          women_only: event.womenOnly ?? false,
          approved_user_ids: event.approvedUserIds,
          request_user_ids: event.requestUserIds,
        },
      ]);

      if (error) {
        console.log("Could not save to Supabase:", error.message);
      } else {
        console.log("Event saved to Supabase successfully");
      }
    } catch (error) {
      console.log("Error saving to Supabase:", error);
    }

    console.log("Returning event:", JSON.stringify(event, null, 2));
    return event;
  };

  const requestToJoin = (eventId: string) => {
    if (!currentUser) {
      return;
    }

    const existing = requests.find(
      (request) =>
        request.eventId === eventId && request.userId === currentUser.id,
    );
    if (existing) {
      return;
    }

    const event = events.find((item) => item.id === eventId);
    if (event?.womenOnly && currentUser.gender !== "woman") {
      return;
    }

    if (
      event?.maxPeople &&
      event.approvedUserIds.length + 1 >= event.maxPeople
    ) {
      return;
    }

    const nextRequest: JoinRequest = {
      id: `r${Date.now()}`,
      userId: currentUser.id,
      eventId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    setRequests((prev) => [...prev, nextRequest]);
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              requestUserIds: [...event.requestUserIds, currentUser.id],
            }
          : event,
      ),
    );
  };

  const approveRequest = (eventId: string, userId: string) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.eventId === eventId && request.userId === userId
          ? { ...request, status: "approved" }
          : request,
      ),
    );
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              requestUserIds: event.requestUserIds.filter(
                (id) => id !== userId,
              ),
              approvedUserIds: [...event.approvedUserIds, userId],
            }
          : event,
      ),
    );
  };

  const rejectRequest = (eventId: string, userId: string) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.eventId === eventId && request.userId === userId
          ? { ...request, status: "rejected" }
          : request,
      ),
    );
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              requestUserIds: event.requestUserIds.filter(
                (id) => id !== userId,
              ),
            }
          : event,
      ),
    );
  };

  const inviteToEvent = (eventId: string, userId: string) => {
    const event = events.find((item) => item.id === eventId);
    if (!event || !currentUser) {
      return;
    }

    if (
      event.approvedUserIds.includes(userId) ||
      event.requestUserIds.includes(userId)
    ) {
      return;
    }

    if (event.creatorId === currentUser.id) {
      setEvents((prev) =>
        prev.map((item) =>
          item.id === eventId
            ? { ...item, approvedUserIds: [...item.approvedUserIds, userId] }
            : item,
        ),
      );
      setRequests((prev) => [
        ...prev,
        {
          id: `r${Date.now()}`,
          eventId,
          userId,
          status: "approved",
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    setRequests((prev) => [
      ...prev,
      {
        id: `r${Date.now()}`,
        eventId,
        userId,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ]);
    setEvents((prev) =>
      prev.map((item) =>
        item.id === eventId
          ? { ...item, requestUserIds: [...item.requestUserIds, userId] }
          : item,
      ),
    );
  };

  const getRequestStatus = (eventId: string) => {
    if (!currentUser) {
      return null;
    }
    return (
      requests.find(
        (request) =>
          request.eventId === eventId && request.userId === currentUser.id,
      )?.status ?? null
    );
  };

  const sendCrewRequest = (userId: string) => {
    if (!currentUser || currentUser.id === userId) {
      return;
    }

    const existing = crewRequests.find(
      (request) =>
        ((request.fromUserId === currentUser.id &&
          request.toUserId === userId) ||
          (request.fromUserId === userId &&
            request.toUserId === currentUser.id)) &&
        request.status !== "rejected",
    );

    if (existing) {
      return;
    }

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
      prev.map((request) =>
        request.id === requestId ? { ...request, status: "accepted" } : request,
      ),
    );
  };

  const rejectCrewRequest = (requestId: string) => {
    setCrewRequests((prev) =>
      prev.map((request) =>
        request.id === requestId ? { ...request, status: "rejected" } : request,
      ),
    );
  };

  const getCrewStatus = (userId: string) => {
    if (!currentUser) {
      return "none";
    }

    const existing = crewRequests.find(
      (request) =>
        (request.fromUserId === currentUser.id &&
          request.toUserId === userId) ||
        (request.fromUserId === userId && request.toUserId === currentUser.id),
    );

    if (!existing) {
      return "none";
    }

    if (existing.status === "accepted") {
      return "connected";
    }

    if (existing.toUserId === currentUser.id) {
      return "pending_incoming";
    }

    return "pending_outgoing";
  };

  const getCrewMembers = () => {
    if (!currentUser) {
      return [];
    }

    const ids = crewRequests
      .filter(
        (request) =>
          request.status === "accepted" &&
          (request.fromUserId === currentUser.id ||
            request.toUserId === currentUser.id),
      )
      .map((request) =>
        request.fromUserId === currentUser.id
          ? request.toUserId
          : request.fromUserId,
      );

    return ids
      .map((id) => users.find((user) => user.id === id))
      .filter(Boolean) as User[];
  };

  const sendMessage = (eventId: string, text: string) => {
    if (!currentUser || !text.trim()) {
      return;
    }

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
    if (!currentUser || currentUser.id === toUserId) {
      return;
    }

    setRatings((prev) => {
      const existingIndex = prev.findIndex(
        (rating) =>
          rating.fromUserId === currentUser.id &&
          rating.toUserId === toUserId &&
          rating.eventId === eventId,
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
    const userRatings = ratings.filter((rating) => rating.toUserId === userId);
    if (!userRatings.length) {
      return null;
    }
    return (
      userRatings.reduce((sum, rating) => sum + rating.stars, 0) /
      userRatings.length
    );
  };

  const getMyRatingForUser = (toUserId: string, eventId?: string) => {
    if (!currentUser) {
      return null;
    }
    return (
      ratings.find(
        (rating) =>
          rating.fromUserId === currentUser.id &&
          rating.toUserId === toUserId &&
          (!eventId || rating.eventId === eventId),
      )?.stars ?? null
    );
  };

  const getUserById = (id: string) => {
    return [...users, currentUser]
      .filter(Boolean)
      .find((user) => user?.id === id);
  };

  const getEventById = (id: string) => {
    return events.find((event) => event.id === id);
  };

  const getEventsImPartOf = () => {
    if (!currentUser) {
      return [];
    }
    return events.filter((event) => {
      if (event.womenOnly && currentUser.gender !== "woman") {
        return false;
      }

      return (
        event.creatorId === currentUser.id ||
        event.approvedUserIds.includes(currentUser.id)
      );
    });
  };

  const getInteractedUsers = () => {
    if (!currentUser) {
      return [];
    }

    const ids = new Set<string>();
    getCrewMembers().forEach((user) => ids.add(user.id));
    getEventsImPartOf().forEach((event) => {
      if (event.creatorId !== currentUser.id) {
        ids.add(event.creatorId);
      }
      event.approvedUserIds.forEach((id) => {
        if (id !== currentUser.id) {
          ids.add(id);
        }
      });
    });

    return [...ids]
      .map((id) => users.find((user) => user.id === id))
      .filter(Boolean) as User[];
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        events,
        requests,
        crewRequests,
        messages,
        ratings,
        isOnboardingComplete,
        shouldShowVerificationPrompt,
        categoryConfig: CATEGORY_CONFIG,
        completeOnboarding,
        socialAuth,
        logout,
        dismissVerificationPrompt,
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
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
