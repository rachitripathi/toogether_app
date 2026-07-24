import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  CATEGORY_CONFIG,
  MOCK_EVENTS,
  MOCK_MESSAGES,
  MOCK_RATINGS,
  MOCK_REQUESTS,
  MOCK_USERS,
} from '@/lib/mockData';
import type {
  CrewRequest,
  Event,
  EventCategory,
  JoinRequest,
  Message,
  Rating,
  RequestStatus,
  User,
} from '@/lib/types';
import {
  CREDIT_PACKS,
  FREE_CREATE_LIMIT,
  FREE_JOIN_LIMIT,
  VERIFIED_JOIN_BONUS,
  getDefaultAppMode,
  type CreditPackId,
  type DevAppMode,
  isMonetisationEnabled,
} from '@/lib/monetisation';

type CreateEventInput = {
  title: string;
  description: string;
  dateTime: string;
  area: string;
  timeSlot: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  exactTime: string;
  exactLocation: string;
  locationNote?: string;
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
  location: string;
  maxPeople?: number;
  category: EventCategory;
  emoji: string;
  womenOnly?: boolean;
};

type SocialProvider = 'google' | 'apple';

type UsageSummary = {
  mode: DevAppMode;
  monetisationEnabled: boolean;
  credits: number;
  joinUsed: number;
  joinLimit: number;
  createUsed: number;
  createLimit: number;
  joinLimitReached: boolean;
  createLimitReached: boolean;
};

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
  devAppMode: DevAppMode;
  monetisationEnabled: boolean;
  setDevAppMode: (mode: DevAppMode) => void;
  getUsageSummary: () => UsageSummary;
  buyCreditPack: (packId: CreditPackId) => void;
  shouldShowPaywallForJoin: () => boolean;
  shouldShowPaywallForCreate: () => boolean;
  isAttendeesUnlocked: (eventId: string) => boolean;
  unlockAttendees: (eventId: string) => boolean;
  completeOnboarding: () => void;
  socialAuth: (provider: SocialProvider, mode: 'login' | 'signup') => void;
  logout: () => void;
  dismissVerificationPrompt: () => void;
  updateCurrentUser: (
    data: Partial<Pick<User, 'name' | 'username' | 'bio' | 'city' | 'avatarUri' | 'avatarColors' | 'age' | 'dob' | 'verified' | 'gender'>>
  ) => void;
  createEvent: (data: CreateEventInput) => Event;
  updateEvent: (
    eventId: string,
    data: Partial<Pick<Event, 'title' | 'description' | 'area' | 'timeSlot' | 'exactTime' | 'locationNote' | 'maxPeople'>>
  ) => void;
  deleteEvent: (eventId: string) => void;
  requestToJoin: (eventId: string) => void;
  approveRequest: (eventId: string, userId: string) => void;
  rejectRequest: (eventId: string, userId: string) => void;
  inviteToEvent: (eventId: string, userId: string) => void;
  getRequestStatus: (eventId: string) => RequestStatus | null;
  sendCrewRequest: (userId: string) => void;
  acceptCrewRequest: (requestId: string) => void;
  rejectCrewRequest: (requestId: string) => void;
  getCrewStatus: (userId: string) => 'none' | 'pending_incoming' | 'pending_outgoing' | 'connected';
  getCrewMembers: () => User[];
  sendMessage: (eventId: string, text: string) => void;
  rateUser: (toUserId: string, eventId: string, stars: number) => void;
  getUserAverageRating: (userId: string) => number | null;
  getMyRatingForUser: (toUserId: string, eventId?: string) => number | null;
  getUserById: (id: string) => User | undefined;
  getEventById: (id: string) => Event | undefined;
  getEventsImPartOf: () => Event[];
  getInteractedUsers: () => User[];
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState(MOCK_USERS);
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [crewRequests, setCrewRequests] = useState<CrewRequest[]>([
    {
      id: 'c1',
      fromUserId: 'u2',
      toUserId: 'u1',
      status: 'accepted',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'c2',
      fromUserId: 'u4',
      toUserId: 'u1',
      status: 'pending',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [ratings, setRatings] = useState(MOCK_RATINGS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [shouldShowVerificationPrompt, setShouldShowVerificationPrompt] = useState(false);
  const [devAppMode, setDevAppMode] = useState<DevAppMode>(getDefaultAppMode);
  const [unlockedAttendeeEventIds, setUnlockedAttendeeEventIds] = useState<string[]>([]);
  const monetisationEnabled = isMonetisationEnabled(devAppMode);

  const withDevUsage = (user: User): User => {
    if (devAppMode === 'free' || devAppMode === 'new-user') {
      return {
        ...user,
        credits: user.credits ?? 0,
        joinRequestsThisMonth: user.joinRequestsThisMonth ?? 1,
        plansCreatedThisMonth: user.plansCreatedThisMonth ?? 1,
      };
    }

    if (devAppMode === 'limit-hit') {
      return {
        ...user,
        credits: 0,
        joinRequestsThisMonth: user.verified ? FREE_JOIN_LIMIT + VERIFIED_JOIN_BONUS : FREE_JOIN_LIMIT,
        plansCreatedThisMonth: FREE_CREATE_LIMIT,
      };
    }

    return {
      ...user,
      credits: user.credits ?? 2,
      joinRequestsThisMonth: user.joinRequestsThisMonth ?? 2,
      plansCreatedThisMonth: user.plansCreatedThisMonth ?? 1,
    };
  };

  const updateCurrentUserUsage = (updater: (user: User) => User) => {
    setCurrentUser((prev) => {
      if (!prev) {
        return prev;
      }
      const next = updater(prev);
      setUsers((usersPrev) => usersPrev.map((user) => (user.id === next.id ? next : user)));
      return next;
    });
  };

  const getUsageSummaryForUser = (user: User | null): UsageSummary => {
    const joinLimit = FREE_JOIN_LIMIT + (user?.verified ? VERIFIED_JOIN_BONUS : 0);
    const credits = user?.credits ?? 0;
    const joinUsed = user?.joinRequestsThisMonth ?? 0;
    const createUsed = user?.plansCreatedThisMonth ?? 0;

    return {
      mode: devAppMode,
      monetisationEnabled,
      credits,
      joinUsed,
      joinLimit,
      createUsed,
      createLimit: FREE_CREATE_LIMIT,
      joinLimitReached: joinUsed >= joinLimit && credits <= 0,
      createLimitReached: createUsed >= FREE_CREATE_LIMIT && credits <= 0,
    };
  };

  const getUsageSummary = () => getUsageSummaryForUser(currentUser);

  const shouldShowPaywallForJoin = () => {
    const usage = getUsageSummary();
    return usage.monetisationEnabled && usage.joinLimitReached;
  };

  const shouldShowPaywallForCreate = () => {
    const usage = getUsageSummary();
    return usage.monetisationEnabled && usage.createLimitReached;
  };

  const socialAuth = (provider: SocialProvider, mode: 'login' | 'signup') => {
    if (provider === 'google') {
      const existing = users.find((item) => item.id === 'u2');
      if (existing) {
        setCurrentUser(withDevUsage(existing));
        setShouldShowVerificationPrompt(false);
        return;
      }
    }

    if (provider === 'apple') {
      const nextUser: User = {
        id: 'u6',
        name: 'Aisha Thomas',
        email: 'aisha@example.com',
        username: 'aishat',
        avatarColors: ['#A78BFA', '#38BDF8'],
        gender: 'woman',
        age: 25,
        city: 'Guwahati',
        verified: true,
        bio: mode === 'signup' ? 'New here and ready for plans.' : 'Always down for one good plan.',
      };
      setCurrentUser(withDevUsage(nextUser));
      setShouldShowVerificationPrompt(false);
      return;
    }

    const nextUser: User = {
      id: 'u1',
      name: 'Aryan Shah',
      email: 'aryan@example.com',
      username: 'aryanshah',
      avatarColors: ['#8B5CF6', '#6366F1'],
      gender: 'man',
      age: 23,
      city: 'Guwahati',
      verified: false,
      bio: 'Living for spontaneous plans.',
    };
    setCurrentUser(withDevUsage(nextUser));
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

  const updateCurrentUser = (
    data: Partial<Pick<User, 'name' | 'username' | 'bio' | 'city' | 'avatarUri' | 'avatarColors' | 'age' | 'dob' | 'verified' | 'gender'>>
  ) => {
    setCurrentUser((prev) => {
      if (!prev) {
        return prev;
      }

      const next = { ...prev, ...data };
      setUsers((usersPrev) => usersPrev.map((user) => (user.id === next.id ? next : user)));
      return next;
    });
  };

  const createEvent = (data: CreateEventInput) => {
    if (!currentUser) {
      throw new Error('createEvent requires a signed-in user');
    }

    const usage = getUsageSummaryForUser(currentUser);
    if (usage.monetisationEnabled && usage.createLimitReached) {
      throw new Error('Plan creation limit reached');
    }

    const event: Event = {
      id: `e${Date.now()}`,
      creatorId: currentUser.id,
      approvedUserIds: [],
      requestUserIds: [],
      ...data,
    };
    setEvents((prev) => [event, ...prev]);
    updateCurrentUserUsage((user) => {
      const shouldSpendCredit = usage.monetisationEnabled && (user.plansCreatedThisMonth ?? 0) >= FREE_CREATE_LIMIT;
      return {
        ...user,
        plansCreatedThisMonth: (user.plansCreatedThisMonth ?? 0) + 1,
        credits: shouldSpendCredit ? Math.max((user.credits ?? 0) - 1, 0) : user.credits ?? 0,
        totalCreditsSpent: shouldSpendCredit ? (user.totalCreditsSpent ?? 0) + 1 : user.totalCreditsSpent ?? 0,
      };
    });
    return event;
  };

  const updateEvent = (
    eventId: string,
    data: Partial<Pick<Event, 'title' | 'description' | 'area' | 'timeSlot' | 'exactTime' | 'locationNote' | 'maxPeople'>>
  ) => {
    setEvents((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, ...data } : event))
    );
  };

  const deleteEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
    setRequests((prev) => prev.filter((request) => request.eventId !== eventId));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  };

  const requestToJoin = (eventId: string) => {
    if (!currentUser) {
      return;
    }

    const existing = requests.find(
      (request) => request.eventId === eventId && request.userId === currentUser.id
    );
    if (existing) {
      return;
    }

    const event = events.find((item) => item.id === eventId);
    if (event?.womenOnly && currentUser.gender !== 'woman') {
      return;
    }

    if (event?.maxPeople && event.approvedUserIds.length + 1 >= event.maxPeople) {
      return;
    }

    const usage = getUsageSummaryForUser(currentUser);
    if (usage.monetisationEnabled && usage.joinLimitReached) {
      return;
    }

    const nextRequest: JoinRequest = {
      id: `r${Date.now()}`,
      userId: currentUser.id,
      eventId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setRequests((prev) => [...prev, nextRequest]);
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? { ...event, requestUserIds: [...event.requestUserIds, currentUser.id] }
          : event
      )
    );
    updateCurrentUserUsage((user) => {
      const freeJoinLimit = FREE_JOIN_LIMIT + (user.verified ? VERIFIED_JOIN_BONUS : 0);
      const nextUsed = (user.joinRequestsThisMonth ?? 0) + 1;
      const shouldSpendCredit = usage.monetisationEnabled && (user.joinRequestsThisMonth ?? 0) >= freeJoinLimit;

      return {
        ...user,
        joinRequestsThisMonth: nextUsed,
        credits: shouldSpendCredit ? Math.max((user.credits ?? 0) - 1, 0) : user.credits ?? 0,
        totalCreditsSpent: shouldSpendCredit ? (user.totalCreditsSpent ?? 0) + 1 : user.totalCreditsSpent ?? 0,
      };
    });
  };

  const buyCreditPack = (packId: CreditPackId) => {
    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    if (!pack) {
      return;
    }

    updateCurrentUserUsage((user) => ({
      ...user,
      credits: (user.credits ?? 0) + pack.credits,
      totalCreditsEarned: (user.totalCreditsEarned ?? 0) + pack.credits,
    }));
  };

  const isAttendeesUnlocked = (eventId: string) => {
    return !monetisationEnabled || unlockedAttendeeEventIds.includes(eventId);
  };

  const unlockAttendees = (eventId: string) => {
    if (!monetisationEnabled || unlockedAttendeeEventIds.includes(eventId)) {
      return true;
    }

    if (!currentUser || (currentUser.credits ?? 0) < 1) {
      return false;
    }

    setUnlockedAttendeeEventIds((prev) => [...prev, eventId]);
    updateCurrentUserUsage((user) => ({
      ...user,
      credits: Math.max((user.credits ?? 0) - 1, 0),
      totalCreditsSpent: (user.totalCreditsSpent ?? 0) + 1,
    }));
    return true;
  };

  const approveRequest = (eventId: string, userId: string) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.eventId === eventId && request.userId === userId
          ? { ...request, status: 'approved' }
          : request
      )
    );
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              requestUserIds: event.requestUserIds.filter((id) => id !== userId),
              approvedUserIds: [...event.approvedUserIds, userId],
            }
          : event
      )
    );
  };

  const rejectRequest = (eventId: string, userId: string) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.eventId === eventId && request.userId === userId
          ? { ...request, status: 'rejected' }
          : request
      )
    );
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? { ...event, requestUserIds: event.requestUserIds.filter((id) => id !== userId) }
          : event
      )
    );
  };

  const inviteToEvent = (eventId: string, userId: string) => {
    const event = events.find((item) => item.id === eventId);
    if (!event || !currentUser) {
      return;
    }

    if (event.approvedUserIds.includes(userId) || event.requestUserIds.includes(userId)) {
      return;
    }

    if (event.creatorId === currentUser.id) {
      setEvents((prev) =>
        prev.map((item) =>
          item.id === eventId
            ? { ...item, approvedUserIds: [...item.approvedUserIds, userId] }
            : item
        )
      );
      setRequests((prev) => [
        ...prev,
        {
          id: `r${Date.now()}`,
          eventId,
          userId,
          status: 'approved',
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
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ]);
    setEvents((prev) =>
      prev.map((item) =>
        item.id === eventId ? { ...item, requestUserIds: [...item.requestUserIds, userId] } : item
      )
    );
  };

  const getRequestStatus = (eventId: string) => {
    if (!currentUser) {
      return null;
    }
    return (
      requests.find((request) => request.eventId === eventId && request.userId === currentUser.id)
        ?.status ?? null
    );
  };

  const sendCrewRequest = (userId: string) => {
    if (!currentUser || currentUser.id === userId) {
      return;
    }

    const existing = crewRequests.find(
      (request) =>
        ((request.fromUserId === currentUser.id && request.toUserId === userId) ||
          (request.fromUserId === userId && request.toUserId === currentUser.id)) &&
        request.status !== 'rejected'
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
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const acceptCrewRequest = (requestId: string) => {
    setCrewRequests((prev) =>
      prev.map((request) =>
        request.id === requestId ? { ...request, status: 'accepted' } : request
      )
    );
  };

  const rejectCrewRequest = (requestId: string) => {
    setCrewRequests((prev) =>
      prev.map((request) =>
        request.id === requestId ? { ...request, status: 'rejected' } : request
      )
    );
  };

  const getCrewStatus = (userId: string) => {
    if (!currentUser) {
      return 'none';
    }

    const existing = crewRequests.find(
      (request) =>
        (request.fromUserId === currentUser.id && request.toUserId === userId) ||
        (request.fromUserId === userId && request.toUserId === currentUser.id)
    );

    if (!existing) {
      return 'none';
    }

    if (existing.status === 'accepted') {
      return 'connected';
    }

    if (existing.toUserId === currentUser.id) {
      return 'pending_incoming';
    }

    return 'pending_outgoing';
  };

  const getCrewMembers = () => {
    if (!currentUser) {
      return [];
    }

    const ids = crewRequests
      .filter(
        (request) =>
          request.status === 'accepted' &&
          (request.fromUserId === currentUser.id || request.toUserId === currentUser.id)
      )
      .map((request) =>
        request.fromUserId === currentUser.id ? request.toUserId : request.fromUserId
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
          rating.eventId === eventId
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
    return userRatings.reduce((sum, rating) => sum + rating.stars, 0) / userRatings.length;
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
          (!eventId || rating.eventId === eventId)
      )?.stars ?? null
    );
  };

  const getUserById = (id: string) => {
    return users.find((user) => user.id === id) ?? (currentUser?.id === id ? currentUser : undefined);
  };

  const getEventById = (id: string) => {
    return events.find((event) => event.id === id);
  };

  const getEventsImPartOf = () => {
    if (!currentUser) {
      return [];
    }
    return events.filter((event) => {
      if (event.womenOnly && currentUser.gender !== 'woman') {
        return false;
      }

      return event.creatorId === currentUser.id || event.approvedUserIds.includes(currentUser.id);
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
        devAppMode,
        monetisationEnabled,
        setDevAppMode,
        getUsageSummary,
        buyCreditPack,
        shouldShowPaywallForJoin,
        shouldShowPaywallForCreate,
        isAttendeesUnlocked,
        unlockAttendees,
        completeOnboarding,
        socialAuth,
        logout,
        dismissVerificationPrompt,
        updateCurrentUser,
        createEvent,
        updateEvent,
        deleteEvent,
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
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
