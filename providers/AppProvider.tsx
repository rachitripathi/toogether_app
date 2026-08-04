import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthContext } from '@/hooks/use-auth-context';
import { supabase } from '@/utils/supabase';
import { CATEGORY_CONFIG, MOCK_RATINGS } from '@/lib/mockData';
import { randomUUID } from '@/lib/uuid';
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

type AuthResult = { error: string | null; needsEmailConfirmation?: boolean };

type SuccessToast = { title: string; subtitle: string };

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
  isLoadingEvents: boolean;
  refreshFeed: () => void;
  requests: JoinRequest[];
  crewRequests: CrewRequest[];
  messages: Record<string, Message[]>;
  ratings: Rating[];
  isOnboardingComplete: boolean;
  isAppReady: boolean;
  shouldShowVerificationPrompt: boolean;
  successToast: SuccessToast | null;
  showSuccessToast: (title: string, subtitle: string) => void;
  clearSuccessToast: () => void;
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
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string) => Promise<AuthResult>;
  socialAuth: (provider: SocialProvider, mode: 'login' | 'signup') => void;
  logout: () => Promise<void>;
  dismissVerificationPrompt: () => void;
  updateCurrentUser: (
    data: Partial<Pick<User, 'name' | 'username' | 'bio' | 'city' | 'avatarUri' | 'avatarColors' | 'age' | 'dob' | 'verified' | 'gender'>>
  ) => void;
  createEvent: (data: CreateEventInput) => Promise<Event>;
  updateEvent: (
    eventId: string,
    data: Partial<Pick<Event, 'title' | 'description' | 'area' | 'timeSlot' | 'exactTime' | 'locationNote' | 'maxPeople'>>
  ) => void;
  deleteEvent: (eventId: string) => void;
  requestToJoin: (eventId: string) => Promise<void>;
  approveRequest: (eventId: string, userId: string) => Promise<void>;
  rejectRequest: (eventId: string, userId: string) => Promise<void>;
  inviteToEvent: (eventId: string, userId: string) => Promise<void>;
  getRequestStatus: (eventId: string) => RequestStatus | null;
  sendCrewRequest: (userId: string) => void;
  acceptCrewRequest: (requestId: string) => void;
  rejectCrewRequest: (requestId: string) => void;
  getCrewStatus: (userId: string) => 'none' | 'pending_incoming' | 'pending_outgoing' | 'connected';
  getCrewMembers: () => User[];
  sendMessage: (eventId: string, text: string) => Promise<void>;
  rateUser: (toUserId: string, eventId: string, stars: number) => void;
  getUserAverageRating: (userId: string) => number | null;
  getMyRatingForUser: (toUserId: string, eventId?: string) => number | null;
  getUserById: (id: string) => User | undefined;
  getEventById: (id: string) => Event | undefined;
  getEventsImPartOf: () => Event[];
  getInteractedUsers: () => User[];
};

const AppContext = createContext<AppContextValue | null>(null);

const getEmailName = (email: string) => email.split('@')[0] || 'New user';

const mapProfileRowToUser = (row: any): User => ({
  id: row.id,
  name: row.name ?? (row.email ? getEmailName(row.email) : 'New user'),
  email: row.email ?? '',
  username: row.username ?? (row.email ? getEmailName(row.email) : ''),
  avatarColors: row.avatar_colors ?? ['#8B5CF6', '#6366F1'],
  avatarUri: row.avatar_uri ?? undefined,
  gender: row.gender ?? 'other',
  age: row.age ?? 0,
  city: row.city ?? '',
  verified: row.verified ?? false,
  bio: row.bio ?? '',
});

const mapEventRow = (row: any): Omit<Event, 'approvedUserIds' | 'requestUserIds'> => ({
  id: row.id,
  title: row.title,
  description: row.description ?? '',
  dateTime: row.date_time,
  area: row.area,
  timeSlot: row.time_slot,
  exactTime: row.exact_time,
  exactLocation: row.exact_location,
  locationNote: row.location_note ?? undefined,
  latitude: row.latitude ?? undefined,
  longitude: row.longitude ?? undefined,
  mapUrl: row.map_url ?? undefined,
  location: row.exact_location,
  creatorId: row.creator_id,
  maxPeople: row.max_people ?? undefined,
  category: row.category,
  emoji: row.emoji,
  womenOnly: row.women_only ?? false,
  pinned: row.pinned ?? false,
});

const mapRequestRow = (row: any): JoinRequest => ({
  id: row.id,
  userId: row.user_id,
  eventId: row.event_id,
  status: row.status,
  createdAt: row.created_at,
});

const mapMessageRow = (row: any): Message => ({
  id: row.id,
  eventId: row.event_id,
  userId: row.user_id,
  text: row.text,
  createdAt: row.created_at,
});

const groupMessagesByEvent = (rows: Message[]): Record<string, Message[]> => {
  const grouped: Record<string, Message[]> = {};
  for (const message of rows) {
    grouped[message.eventId] = [...(grouped[message.eventId] ?? []), message];
  }
  return grouped;
};

const hydrateEvents = (
  rawEvents: Omit<Event, 'approvedUserIds' | 'requestUserIds'>[],
  rawRequests: JoinRequest[]
): Event[] =>
  rawEvents.map((event) => ({
    ...event,
    approvedUserIds: rawRequests
      .filter((request) => request.eventId === event.id && request.status === 'approved')
      .map((request) => request.userId),
    requestUserIds: rawRequests
      .filter((request) => request.eventId === event.id && request.status === 'pending')
      .map((request) => request.userId),
  }));

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

const AUTH_TIMEOUT_MS = 15000;

const withAuthTimeout = <T,>(promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Couldn't reach the server. Check your internet connection and try again.")), AUTH_TIMEOUT_MS)
    ),
  ]);

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile, isLoggedIn, isLoading: isAuthLoading, refreshProfile } = useAuthContext();

  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [refreshFeedToken, setRefreshFeedToken] = useState(0);
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
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [ratings, setRatings] = useState(MOCK_RATINGS);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isOnboardingLoaded, setIsOnboardingLoaded] = useState(false);
  const [shouldShowVerificationPrompt, setShouldShowVerificationPrompt] = useState(false);
  const [successToast, setSuccessToast] = useState<SuccessToast | null>(null);
  const showSuccessToast = (title: string, subtitle: string) => setSuccessToast({ title, subtitle });
  const clearSuccessToast = () => setSuccessToast(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((value) => setIsOnboardingComplete(value === 'true'))
      .finally(() => setIsOnboardingLoaded(true));
  }, []);

  // Onboarding is considered "loaded" once we've read the persisted flag, and the
  // app is "ready" once we also know whether there's a logged-in session — index.tsx
  // waits on this so it never briefly redirects to /auth for an already-logged-in
  // user before the session has had a chance to load.
  const isAppReady = isOnboardingLoaded && !isAuthLoading;
  const [devAppMode, setDevAppMode] = useState<DevAppMode>(getDefaultAppMode);
  const [unlockedAttendeeEventIds, setUnlockedAttendeeEventIds] = useState<string[]>([]);
  const [usageState, setUsageState] = useState<
    Partial<Pick<User, 'credits' | 'joinRequestsThisMonth' | 'plansCreatedThisMonth' | 'totalCreditsEarned' | 'totalCreditsSpent'>>
  >({});
  const monetisationEnabled = isMonetisationEnabled(devAppMode);

  const baseUser: User | null = profile ? mapProfileRowToUser(profile) : null;

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

  const currentUser: User | null = baseUser ? withDevUsage({ ...baseUser, ...usageState }) : null;

  useEffect(() => {
    setUsageState({});
  }, [baseUser?.id]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    let cancelled = false;

    const fetchUsers = async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!cancelled && !error && data) {
        setUsers(data.map(mapProfileRowToUser));
      }
    };

    const fetchMessages = async () => {
      const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
      if (!cancelled && !error && data) {
        setMessages(groupMessagesByEvent(data.map(mapMessageRow)));
      } else if (error) {
        console.error('Error fetching messages:', error);
      }
    };

    const fetchEventsAndRequests = async () => {
      setIsLoadingEvents(true);
      const [eventsRes, requestsRes] = await Promise.all([
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('join_requests').select('*'),
      ]);

      if (cancelled) {
        return;
      }

      if (!eventsRes.error && !requestsRes.error && eventsRes.data && requestsRes.data) {
        const mappedRequests = requestsRes.data.map(mapRequestRow);
        setRequests(mappedRequests);
        setEvents(hydrateEvents(eventsRes.data.map(mapEventRow), mappedRequests));
      } else {
        if (eventsRes.error) console.error('Error fetching events:', eventsRes.error);
        if (requestsRes.error) console.error('Error fetching join requests:', requestsRes.error);
      }
      setIsLoadingEvents(false);
    };

    fetchUsers();
    fetchEventsAndRequests();
    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, refreshFeedToken]);

  const refreshFeed = () => setRefreshFeedToken((token) => token + 1);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const message = mapMessageRow(payload.new);
          setMessages((prev) => {
            const existing = prev[message.eventId] ?? [];
            if (existing.some((item) => item.id === message.id)) {
              return prev;
            }
            return { ...prev, [message.eventId]: [...existing, message] };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn]);

  const updateCurrentUserUsage = (updater: (user: User) => User) => {
    if (!currentUser) return;
    const next = updater(currentUser);
    setUsageState({
      credits: next.credits,
      joinRequestsThisMonth: next.joinRequestsThisMonth,
      plansCreatedThisMonth: next.plansCreatedThisMonth,
      totalCreditsEarned: next.totalCreditsEarned,
      totalCreditsSpent: next.totalCreditsSpent,
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

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await withAuthTimeout(supabase.auth.signInWithPassword({ email, password }));
      return { error: error?.message ?? null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Login timed out. Check your internet connection and try again.' };
    }
  };

  const signup = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await withAuthTimeout(supabase.auth.signUp({ email, password }));
      if (error) {
        return { error: error.message };
      }

      // Profile row creation is handled by AuthProvider.fetchProfile() once the
      // resulting auth state change delivers claims — don't race it with a second insert here.
      return { error: null, needsEmailConfirmation: !data.session };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Signup timed out. Check your internet connection and try again.' };
    }
  };

  const socialAuth = (_provider: SocialProvider, _mode: 'login' | 'signup') => {
    // Real Google/Apple sign-in isn't configured yet (needs OAuth provider setup in Supabase + native SDKs).
    console.log('Social auth not yet implemented');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setShouldShowVerificationPrompt(false);
  };

  const completeOnboarding = () => {
    setIsOnboardingComplete(true);
    AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  };

  const dismissVerificationPrompt = () => {
    setShouldShowVerificationPrompt(false);
  };

  const updateCurrentUser = (
    data: Partial<Pick<User, 'name' | 'username' | 'bio' | 'city' | 'avatarUri' | 'avatarColors' | 'age' | 'dob' | 'verified' | 'gender'>>
  ) => {
    if (!currentUser) return;
    const userId = currentUser.id;

    (async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          username: data.username,
          bio: data.bio,
          city: data.city,
          avatar_uri: data.avatarUri,
          avatar_colors: data.avatarColors,
          age: data.age,
          verified: data.verified,
          gender: data.gender,
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating profile:', error);
        return;
      }

      await refreshProfile();
      const { data: refreshedRow } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (refreshedRow) {
        const refreshedUser = mapProfileRowToUser(refreshedRow);
        setUsers((prev) => {
          const exists = prev.some((user) => user.id === userId);
          return exists ? prev.map((user) => (user.id === userId ? refreshedUser : user)) : [...prev, refreshedUser];
        });
      }
    })();
  };

  const createEvent = async (data: CreateEventInput): Promise<Event> => {
    if (!currentUser) {
      throw new Error('createEvent requires a signed-in user');
    }

    const usage = getUsageSummaryForUser(currentUser);
    if (usage.monetisationEnabled && usage.createLimitReached) {
      throw new Error('Plan creation limit reached');
    }

    const event: Event = {
      id: randomUUID(),
      creatorId: currentUser.id,
      approvedUserIds: [],
      requestUserIds: [],
      ...data,
    };

    const { error } = await supabase.from('events').insert([
      {
        id: event.id,
        creator_id: event.creatorId,
        title: event.title,
        description: event.description,
        date_time: event.dateTime,
        area: event.area,
        exact_time: event.exactTime,
        exact_location: event.exactLocation,
        location_note: event.locationNote ?? null,
        latitude: event.latitude ?? null,
        longitude: event.longitude ?? null,
        map_url: event.mapUrl ?? null,
        time_slot: event.timeSlot,
        category: event.category,
        emoji: event.emoji,
        max_people: event.maxPeople ?? null,
        women_only: event.womenOnly ?? false,
        pinned: false,
      },
    ]);

    if (error) {
      console.error('Error saving event:', error);
      throw new Error(error.message);
    }

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
    const previous = events.find((event) => event.id === eventId);
    setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, ...data } : event)));

    (async () => {
      const { error } = await supabase
        .from('events')
        .update({
          title: data.title,
          description: data.description,
          area: data.area,
          time_slot: data.timeSlot,
          exact_time: data.exactTime,
          location_note: data.locationNote,
          max_people: data.maxPeople,
        })
        .eq('id', eventId);

      if (error) {
        console.error('Error updating event:', error);
        if (previous) {
          setEvents((prev) => prev.map((event) => (event.id === eventId ? previous : event)));
        }
      }
    })();
  };

  const deleteEvent = (eventId: string) => {
    const previousEvent = events.find((event) => event.id === eventId);
    const previousMessages = messages[eventId];

    setEvents((prev) => prev.filter((event) => event.id !== eventId));
    setRequests((prev) => prev.filter((request) => request.eventId !== eventId));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });

    (async () => {
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) {
        console.error('Error deleting event:', error);
        if (previousEvent) {
          setEvents((prev) => [previousEvent, ...prev]);
        }
        if (previousMessages) {
          setMessages((prev) => ({ ...prev, [eventId]: previousMessages }));
        }
      }
    })();
  };

  const requestToJoin = async (eventId: string): Promise<void> => {
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
      throw new Error('This is a women-only plan.');
    }

    if (event?.maxPeople && event.approvedUserIds.length + 1 >= event.maxPeople) {
      throw new Error('This plan is already full.');
    }

    const usage = getUsageSummaryForUser(currentUser);
    if (usage.monetisationEnabled && usage.joinLimitReached) {
      return;
    }

    const nextRequest: JoinRequest = {
      id: randomUUID(),
      userId: currentUser.id,
      eventId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const { error } = await supabase.from('join_requests').insert([
      {
        id: nextRequest.id,
        user_id: currentUser.id,
        event_id: eventId,
        status: 'pending',
      },
    ]);

    if (error) {
      console.error('Error creating join request:', error);
      throw new Error(error.message);
    }

    setRequests((prev) => [...prev, nextRequest]);
    setEvents((prev) =>
      prev.map((item) =>
        item.id === eventId ? { ...item, requestUserIds: [...item.requestUserIds, currentUser.id] } : item
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

  const approveRequest = async (eventId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('join_requests')
      .update({ status: 'approved' })
      .eq('user_id', userId)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error approving request:', error);
      throw new Error(error.message);
    }

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

  const rejectRequest = async (eventId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('join_requests')
      .update({ status: 'rejected' })
      .eq('user_id', userId)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error rejecting request:', error);
      throw new Error(error.message);
    }

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

  const inviteToEvent = async (eventId: string, userId: string): Promise<void> => {
    const event = events.find((item) => item.id === eventId);
    if (!event || !currentUser) {
      return;
    }

    if (event.approvedUserIds.includes(userId) || event.requestUserIds.includes(userId)) {
      return;
    }

    const inviteId = randomUUID();
    const status = event.creatorId === currentUser.id ? 'approved' : 'pending';

    const { error } = await supabase.from('join_requests').insert([
      { id: inviteId, user_id: userId, event_id: eventId, status },
    ]);

    if (error) {
      console.error('Error creating invite:', error);
      throw new Error(error.message);
    }

    setRequests((prev) => [
      ...prev,
      { id: inviteId, eventId, userId, status, createdAt: new Date().toISOString() },
    ]);
    setEvents((prev) =>
      prev.map((item) =>
        item.id === eventId
          ? status === 'approved'
            ? { ...item, approvedUserIds: [...item.approvedUserIds, userId] }
            : { ...item, requestUserIds: [...item.requestUserIds, userId] }
          : item
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

  const sendMessage = async (eventId: string, text: string): Promise<void> => {
    if (!currentUser || !text.trim()) {
      return;
    }

    const message: Message = {
      id: randomUUID(),
      eventId,
      userId: currentUser.id,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('messages')
      .insert([{ id: message.id, event_id: message.eventId, user_id: message.userId, text: message.text }]);

    if (error) {
      console.error('Error sending message:', error);
      throw new Error(error.message);
    }

    setMessages((prev) => {
      const existing = prev[eventId] ?? [];
      if (existing.some((item) => item.id === message.id)) {
        return prev;
      }
      return { ...prev, [eventId]: [...existing, message] };
    });
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
        isLoadingEvents,
        refreshFeed,
        requests,
        crewRequests,
        messages,
        ratings,
        isOnboardingComplete,
        isAppReady,
        shouldShowVerificationPrompt,
        successToast,
        showSuccessToast,
        clearSuccessToast,
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
        login,
        signup,
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
