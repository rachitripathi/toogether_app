import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthContext } from '@/hooks/use-auth-context';
import { markExplicitSignOut } from '@/providers/auth-provider';
import { supabase } from '@/utils/supabase';
import { wasRestoredBySystem } from '@/modules/launch-state';
import { unregisterPushToken } from '@/lib/pushToken';
import { uploadVerificationDocument } from '@/lib/cloudinary';
import { CATEGORY_CONFIG } from '@/lib/mockData';
import { mapKarmaRow, type KarmaInfo } from '@/lib/karma';
import { randomUUID } from '@/lib/uuid';
import type {
  CrewRecommendation,
  CrewRequest,
  Event,
  EventCategory,
  JoinRequest,
  Message,
  RequestStatus,
  User,
  VerificationStatus,
} from '@/lib/types';
import { MAX_JOIN_REQUEST_ATTEMPTS } from '@/lib/types';
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

// What a host may change after posting (see updateEvent).
type EventEdit = Partial<Pick<Event, 'description' | 'dateTime' | 'exactTime' | 'timeSlot'>>;

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
  crewRecommendations: CrewRecommendation[];
  isLoadingRecommendations: boolean;
  refreshCrewRecommendations: () => Promise<void>;
  isOnboardingComplete: boolean;
  isAppReady: boolean;
  lastRoute: string | null;
  recordRoute: (pathname: string) => void;
  shouldShowVerificationPrompt: boolean;
  shouldShowSafetyTips: boolean;
  dismissSafetyTips: () => void;
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
    data: Partial<Pick<User, 'name' | 'username' | 'city' | 'avatarUri' | 'avatarColors' | 'age' | 'dob' | 'verified' | 'gender'>>
  ) => Promise<void>;
  submitVerification: (
    data: { aadhaarFrontUri: string; aadhaarBackUri: string; selfieUri: string },
    onProgress?: (uploaded: number) => void
  ) => Promise<void>;
  setVerificationStatusDev: (status: VerificationStatus, reason?: string) => void;
  createEvent: (data: CreateEventInput) => Promise<Event>;
  updateEvent: (eventId: string, data: EventEdit) => Promise<void>;
  deleteEvent: (eventId: string) => void;
  requestToJoin: (eventId: string) => Promise<void>;
  rerequestToJoin: (eventId: string) => Promise<void>;
  getRequestAttempts: (eventId: string) => number;
  approveRequest: (eventId: string, userId: string) => Promise<void>;
  rejectRequest: (eventId: string, userId: string) => Promise<void>;
  removeMember: (eventId: string, userId: string) => Promise<void>;
  reportMember: (eventId: string, userId: string, reason: string) => Promise<void>;
  resolveMemberReports: (eventId: string, userId: string, remove: boolean) => Promise<void>;
  inviteToEvent: (eventId: string, userId: string) => Promise<void>;
  respondToInvite: (eventId: string, accept: boolean) => Promise<void>;
  getRequestStatus: (eventId: string) => RequestStatus | null;
  sendCrewRequest: (userId: string) => Promise<void>;
  acceptCrewRequest: (requestId: string) => Promise<void>;
  rejectCrewRequest: (requestId: string) => Promise<void>;
  removeFromCrew: (userId: string) => Promise<void>;
  getCrewStatus: (userId: string) => 'none' | 'pending_incoming' | 'pending_outgoing' | 'connected';
  getCrewMembers: () => User[];
  sendMessage: (eventId: string, text: string) => Promise<void>;
  refreshEventMessages: (eventId: string) => Promise<void>;
  getUserKarma: (userId: string) => KarmaInfo | null;
  getUserById: (id: string) => User | undefined;
  getEventById: (id: string) => Event | undefined;
  getEventsImPartOf: () => Event[];
  getInteractedUsers: () => User[];
};

const AppContext = createContext<AppContextValue | null>(null);

// PostgREST answers PGRST202 when an RPC doesn't exist, i.e. its migration hasn't been run on
// this Supabase project yet. Karma refetches on every data change, so log that once as a warning
// naming the fix instead of an error each time; real failures still log as errors.
const warnedMissingRpcs = new Set<string>();
const logRpcError = (rpc: string, migration: string, error: { code?: string; message: string }) => {
  if (error.code === 'PGRST202') {
    if (!warnedMissingRpcs.has(rpc)) {
      warnedMissingRpcs.add(rpc);
      console.warn(`${rpc}() is missing on Supabase. Run migrations/${migration} in the SQL editor.`);
    }
    return;
  }
  console.error(`Error calling ${rpc}:`, error);
};

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
  verificationStatus: row.verification_status ?? 'unverified',
  verificationSubmittedAt: row.verification_submitted_at ?? undefined,
  verificationRejectionReason: row.verification_rejection_reason ?? undefined,
});

// An event as stored — attendee/request id lists are derived from `requests`, never stored.
type EventRow = Omit<Event, 'approvedUserIds' | 'requestUserIds'>;

const mapEventRow = (row: any): EventRow => ({
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
  attempts: row.attempts ?? 1,
  createdAt: row.created_at,
});

const mapCrewRow = (row: any): CrewRequest => ({
  id: row.id,
  fromUserId: row.from_user_id,
  toUserId: row.to_user_id,
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

// Single pass over requests (O(events + requests)) instead of filtering the whole request
// list once per event.
const hydrateEvents = (rawEvents: EventRow[], rawRequests: JoinRequest[]): Event[] => {
  const byEvent = new Map<string, { approved: string[]; pending: string[] }>();
  for (const request of rawRequests) {
    if (request.status !== 'approved' && request.status !== 'pending') continue;
    let bucket = byEvent.get(request.eventId);
    if (!bucket) {
      bucket = { approved: [], pending: [] };
      byEvent.set(request.eventId, bucket);
    }
    (request.status === 'approved' ? bucket.approved : bucket.pending).push(request.userId);
  }
  return rawEvents.map((event) => {
    const bucket = byEvent.get(event.id);
    return { ...event, approvedUserIds: bucket?.approved ?? [], requestUserIds: bucket?.pending ?? [] };
  });
};

// Insert-or-replace by id, keeping list order (new items go to the front/back as asked).
const upsertById = <T extends { id: string }>(list: T[], item: T, prepend = false): T[] => {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) return prepend ? [item, ...list] : [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
};

// Don't re-sync on every brief background→foreground flip (e.g. a quick app switch);
// a resume after this long is worth a fresh fetch.
const RESUME_SYNC_MIN_INTERVAL_MS = 5000;

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

// The screen the user was actually looking at, persisted so that when Android reclaims the
// process in the background (e.g. while its Quick Settings panel is open to flip light/dark
// mode) and the user comes back to the app from recents, it lands back where they were
// instead of bouncing to Home. It is only honoured for that system-initiated relaunch
// (wasRestoredBySystem, modules/launch-state): a launch after the user swiped the app out of
// recents is a deliberate fresh start and goes to Home, like a first launch. app/index.tsx's
// initial redirect for an already-logged-in, already-onboarded user reads this. Screens that
// shouldn't ever be "resumed into" — pre-auth flows and one-off modals whose form state is
// lost anyway — are filtered out below.
const LAST_ROUTE_KEY = 'last_route';
const NON_RESTORABLE_ROUTE_PREFIXES = [
  '/onboarding',
  '/auth',
  '/reset-password',
  '/new-user-profile',
  '/new-user-verification',
  '/create-event',
  '/location-picker',
  '/paywall',
];
const isRestorableRoute = (pathname: string) =>
  pathname !== '/' && !NON_RESTORABLE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// Shown once, the first time it's actually relevant — either the user creates their
// first plan (as a host, about to meet whoever joins) or gets approved into someone
// else's (as a joiner, about to meet the host/other attendees). After that first time,
// it's only reachable via the small persistent "Safety tips" link on the event screen
// and the reminder banner in chat — never nagged again automatically.
const SAFETY_TIPS_SEEN_KEY = 'safety_tips_seen';

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
  // Events and join requests are stored once each; every event's approvedUserIds /
  // requestUserIds is derived from `requests` below, so a request change (local mutation,
  // realtime push, or resync) can never leave the two out of step.
  const [rawEvents, setRawEvents] = useState<EventRow[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const events = useMemo(() => hydrateEvents(rawEvents, requests), [rawEvents, requests]);
  const pendingJoinEventIds = useRef<Set<string>>(new Set());
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [refreshFeedToken, setRefreshFeedToken] = useState(0);
  // Profile ids already loaded or currently being fetched — keeps ensureUsers() from
  // re-requesting the same profile for every realtime event that mentions it.
  const knownUserIds = useRef<Set<string>>(new Set());
  // Monotonic id so an older, slower events/requests fetch can't overwrite a newer one.
  const eventsSyncSeq = useRef(0);
  const lastEventsSyncAt = useRef(0);
  // Real crew_requests rows the user is on either side of (RLS: crew_requests_select_own).
  // Written only through RPCs (migration 014), kept live by the feed-realtime channel below.
  const [crewRequests, setCrewRequests] = useState<CrewRequest[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  // Karma per user id, from get_karma() (migration 019). Derived server-side from real rows;
  // refetched for every known user after login, resume, and (debounced) whenever requests,
  // events or crew change, since any of those can move someone's karma.
  const [karmaByUser, setKarmaByUser] = useState<Record<string, KarmaInfo>>({});
  const [crewRecommendations, setCrewRecommendations] = useState<CrewRecommendation[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isOnboardingLoaded, setIsOnboardingLoaded] = useState(false);
  const [lastRoute, setLastRoute] = useState<string | null>(null);
  const [isLastRouteLoaded, setIsLastRouteLoaded] = useState(false);
  const [shouldShowVerificationPrompt, setShouldShowVerificationPrompt] = useState(false);
  const [shouldShowSafetyTips, setShouldShowSafetyTips] = useState(false);
  // Ref, not state — read synchronously from triggerSafetyTips() so two trigger calls
  // in quick succession (e.g. creating an event right as an old approval also resolves)
  // can't both slip through before the AsyncStorage write from the first one lands.
  const hasSeenSafetyTipsRef = useRef(false);
  const [successToast, setSuccessToast] = useState<SuccessToast | null>(null);
  const showSuccessToast = (title: string, subtitle: string) => setSuccessToast({ title, subtitle });
  const clearSuccessToast = () => setSuccessToast(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((value) => setIsOnboardingComplete(value === 'true'))
      .finally(() => setIsOnboardingLoaded(true));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LAST_ROUTE_KEY)
      .then((value) => setLastRoute(wasRestoredBySystem() ? value : null))
      .finally(() => setIsLastRouteLoaded(true));
  }, []);

  const recordRoute = (pathname: string) => {
    if (!isRestorableRoute(pathname)) return;
    setLastRoute(pathname);
    AsyncStorage.setItem(LAST_ROUTE_KEY, pathname).catch(() => {});
  };

  useEffect(() => {
    AsyncStorage.getItem(SAFETY_TIPS_SEEN_KEY).then((value) => {
      if (value === 'true') hasSeenSafetyTipsRef.current = true;
    });
  }, []);

  const triggerSafetyTips = () => {
    if (hasSeenSafetyTipsRef.current) return;
    hasSeenSafetyTipsRef.current = true;
    setShouldShowSafetyTips(true);
    AsyncStorage.setItem(SAFETY_TIPS_SEEN_KEY, 'true').catch(() => {});
  };

  const dismissSafetyTips = () => setShouldShowSafetyTips(false);

  // Onboarding is considered "loaded" once we've read the persisted flag, and the
  // app is "ready" once we also know whether there's a logged-in session — index.tsx
  // waits on this so it never briefly redirects to /auth for an already-logged-in
  // user before the session has had a chance to load.
  const isAppReady = isOnboardingLoaded && isLastRouteLoaded && !isAuthLoading;
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

  // Joiner side of the safety-tips trigger: the moment one of the current user's own
  // join requests turns 'approved', they know they're about to meet the host/other
  // attendees in person. Runs regardless of which screen they're on when it happens
  // (the sheet itself is rendered once, globally, in app/_layout.tsx) — no need to
  // wire this into every screen that can show a request status.
  useEffect(() => {
    if (!currentUser) return;
    const hasApprovedRequest = requests.some(
      (request) => request.userId === currentUser.id && request.status === 'approved'
    );
    if (hasApprovedRequest) triggerSafetyTips();
  }, [requests, currentUser?.id]);

  // Loads any profiles we don't have yet. The full profile list is only fetched at login,
  // so someone who signs up afterwards and then requests to join (or creates a plan)
  // would otherwise be unknown here — and the event screen skips rows it can't resolve
  // to a user, which made fresh join requests invisible until a manual refresh.
  const ensureUsers = async (ids: Iterable<string>) => {
    const missing = [...new Set(ids)].filter((id) => !knownUserIds.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => knownUserIds.current.add(id));

    const { data, error } = await supabase.from('profiles').select('*').in('id', missing);
    if (error || !data) {
      if (error) console.error('Error fetching profiles:', error);
      missing.forEach((id) => knownUserIds.current.delete(id)); // allow a later retry
      return;
    }
    const fetched = data.map(mapProfileRowToUser);
    setUsers((prev) => fetched.reduce((list, user) => upsertById(list, user), prev));
  };

  // Fetches events + join requests together. Used for the initial load, pull-to-refresh,
  // and every return to the foreground: realtime (below) can't deliver anything while the
  // app is backgrounded/its socket is down, so a resume — e.g. tapping a "wants to join"
  // push — must re-read the source of truth rather than trust in-memory state.
  const syncEventsAndRequests = async () => {
    const seq = ++eventsSyncSeq.current;
    lastEventsSyncAt.current = Date.now();
    setIsLoadingEvents(true);
    const [eventsRes, requestsRes] = await Promise.all([
      supabase.from('events').select('*').order('created_at', { ascending: false }),
      supabase.from('join_requests').select('*'),
    ]);

    if (seq !== eventsSyncSeq.current) {
      return []; // superseded by a newer sync (or logout)
    }

    if (!eventsRes.error && !requestsRes.error && eventsRes.data && requestsRes.data) {
      const mappedRequests = requestsRes.data.map(mapRequestRow);
      const mappedEvents = eventsRes.data.map(mapEventRow);
      setRequests(mappedRequests);
      setRawEvents(mappedEvents);
      setIsLoadingEvents(false);
      // Profile ids this data references, for the caller to pass to ensureUsers().
      return [...mappedRequests.map((r) => r.userId), ...mappedEvents.map((e) => e.creatorId)];
    }
    if (eventsRes.error) console.error('Error fetching events:', eventsRes.error);
    if (requestsRes.error) console.error('Error fetching join requests:', requestsRes.error);
    setIsLoadingEvents(false);
    return [];
  };

  // Returns the profile ids involved, for ensureUsers().
  const syncCrewRequests = async () => {
    const { data, error } = await supabase.from('crew_requests').select('*');
    if (error || !data) {
      if (error) console.error('Error fetching crew requests:', error);
      return [];
    }
    const mapped = data.map(mapCrewRow);
    setCrewRequests(mapped);
    return mapped.flatMap((request) => [request.fromUserId, request.toUserId]);
  };

  const refreshKarma = async (ids: string[]) => {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const { data, error } = await supabase.rpc('get_karma', { p_user_ids: unique });
    if (error || !data) {
      if (error) logRpcError('get_karma', '019_karma_and_crew_recommendations.sql', error);
      return;
    }
    setKarmaByUser((prev) => {
      const next = { ...prev };
      (data as any[]).forEach((row) => {
        next[row.user_id] = mapKarmaRow(row);
      });
      return next;
    });
  };

  // People to suggest on the Crew tab's Recommendations (get_crew_recommendations(), migration
  // 019): ranked by shared plans, then mutual crew, then same city. Excludes current crew,
  // pending requests and declined pairs.
  const refreshCrewRecommendations = async () => {
    if (!isLoggedIn) return;
    setIsLoadingRecommendations(true);
    const { data, error } = await supabase.rpc('get_crew_recommendations', { p_limit: 40 });
    setIsLoadingRecommendations(false);
    if (error || !data) {
      if (error) logRpcError('get_crew_recommendations', '019_karma_and_crew_recommendations.sql', error);
      return;
    }
    const mapped: CrewRecommendation[] = (data as any[]).map((row) => ({
      userId: row.user_id,
      sharedPlans: row.shared_plans ?? 0,
      mutualCrew: row.mutual_crew ?? 0,
      sameCity: Boolean(row.same_city),
      score: row.score ?? 0,
    }));
    setCrewRecommendations(mapped);
    ensureUsers(mapped.map((rec) => rec.userId));
  };

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    let cancelled = false;

    const fetchUsers = async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!cancelled && !error && data) {
        const mapped = data.map(mapProfileRowToUser);
        mapped.forEach((user) => knownUserIds.current.add(user.id));
        setUsers(mapped);
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

    fetchMessages();
    // Resolve profiles only after the full list lands, so the initial load doesn't
    // re-fetch profiles that fetchUsers() is already bringing in.
    Promise.all([fetchUsers(), syncEventsAndRequests(), syncCrewRequests()]).then(([, referencedUserIds, crewUserIds]) => {
      if (!cancelled) ensureUsers([...referencedUserIds, ...crewUserIds]);
    });

    return () => {
      cancelled = true;
      eventsSyncSeq.current++; // drop any in-flight events/requests response
    };
  }, [isLoggedIn, refreshFeedToken]);

  const refreshFeed = () => setRefreshFeedToken((token) => token + 1);

  // Karma depends on events, join requests and crew, so refetch it (for everyone we know)
  // shortly after any of them change. Debounced so a burst of realtime rows is one call.
  useEffect(() => {
    if (!isLoggedIn || !users.length) return;
    const timer = setTimeout(() => {
      refreshKarma([...users.map((user) => user.id), ...(currentUser ? [currentUser.id] : [])]);
    }, 800);
    return () => clearTimeout(timer);
  }, [isLoggedIn, users.length, rawEvents, requests, crewRequests, currentUser?.verified]);

  // Resync on return to the foreground (see syncEventsAndRequests for why).
  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const resumed = previousState !== 'active' && nextState === 'active';
      previousState = nextState;
      if (resumed && Date.now() - lastEventsSyncAt.current > RESUME_SYNC_MIN_INTERVAL_MS) {
        syncEventsAndRequests().then(ensureUsers);
        syncCrewRequests().then(ensureUsers);
      }
    });

    return () => subscription.remove();
  }, [isLoggedIn]);

  // Live join-request and event changes while the app is open, so a host sees a new
  // request (and a requester sees approve/reject) without refreshing. Rows arrive filtered
  // by each table's SELECT RLS policy, so this only ever delivers what the user could
  // fetch anyway. Requires migration 012 (adds both tables to supabase_realtime).
  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const removedId = (payload.old as { id?: string }).id;
          if (removedId) setRequests((prev) => prev.filter((request) => request.id !== removedId));
          return;
        }
        const request = mapRequestRow(payload.new);
        setRequests((prev) => upsertById(prev, request));
        ensureUsers([request.userId]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const removedId = (payload.old as { id?: string }).id;
          if (removedId) setRawEvents((prev) => prev.filter((event) => event.id !== removedId));
          return;
        }
        const row = payload.new as { deleted_at?: string | null };
        const event = mapEventRow(payload.new);
        if (row.deleted_at) {
          setRawEvents((prev) => prev.filter((item) => item.id !== event.id));
          return;
        }
        setRawEvents((prev) => upsertById(prev, event, true));
        ensureUsers([event.creatorId]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crew_requests' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const removedId = (payload.old as { id?: string }).id;
          if (removedId) setCrewRequests((prev) => prev.filter((request) => request.id !== removedId));
          return;
        }
        const request = mapCrewRow(payload.new);
        setCrewRequests((prev) => upsertById(prev, request));
        ensureUsers([request.fromUserId, request.toUserId]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn]);

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
    // Before signOut: the push_tokens delete needs the still-valid session (see lib/pushToken.ts).
    await unregisterPushToken();
    markExplicitSignOut();
    await supabase.auth.signOut();
    setShouldShowVerificationPrompt(false);
    setCrewRequests([]);
    setKarmaByUser({});
    setCrewRecommendations([]);
    setLastRoute(null);
    AsyncStorage.removeItem(LAST_ROUTE_KEY).catch(() => {});
  };

  const completeOnboarding = () => {
    setIsOnboardingComplete(true);
    AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  };

  const dismissVerificationPrompt = () => {
    setShouldShowVerificationPrompt(false);
  };

  // Rejects if the save fails. It used to fire and forget and only log the error, so a failed
  // profile-photo save looked like the photo just "didn't change".
  const updateCurrentUser = async (
    data: Partial<Pick<User, 'name' | 'username' | 'city' | 'avatarUri' | 'avatarColors' | 'age' | 'dob' | 'verified' | 'gender'>>
  ): Promise<void> => {
    if (!currentUser) return;
    const userId = currentUser.id;

    const { error } = await supabase
      .from('profiles')
      .update({
        name: data.name,
        username: data.username,
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
      throw new Error(error.message);
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
  };

  // Uploads the three photos, records their URLs, and only then marks the profile 'pending'.
  // This used to flip to 'pending' first and upload in the background; when an upload failed
  // it quietly reset the user to 'unverified' after they'd left the screen, so to them it looked
  // like the submission just vanished, and an admin could see 'pending' with no documents.
  // Doing it in order means a failure is reported on the submit screen with the photos still
  // there to retry, and 'pending' always has documents behind it. onProgress gets the number of
  // photos uploaded so far (0-3).
  const submitVerification = async (
    data: { aadhaarFrontUri: string; aadhaarBackUri: string; selfieUri: string },
    onProgress?: (uploaded: number) => void
  ) => {
    if (!currentUser) return;
    const userId = currentUser.id;

    let uploaded = 0;
    onProgress?.(uploaded);
    const upload = async (uri: string) => {
      const url = await uploadVerificationDocument(uri);
      onProgress?.(++uploaded);
      return url;
    };

    let urls: string[];
    try {
      urls = await Promise.all([upload(data.aadhaarFrontUri), upload(data.aadhaarBackUri), upload(data.selfieUri)]);
    } catch (uploadError) {
      console.error('Error uploading verification documents:', uploadError);
      throw new Error(
        `We couldn't upload your photos (${uploadError instanceof Error ? uploadError.message : 'network error'}). Check your connection and try again.`
      );
    }
    const [frontUrl, backUrl, selfieUrl] = urls;

    // Sensitive document URLs live in verification_documents (owner/admin-only RLS), separate
    // from the publicly-readable profiles row — see migrations/007_secure_verification_admin.sql.
    const { error: docsError } = await supabase.from('verification_documents').upsert(
      {
        user_id: userId,
        aadhaar_front_uri: frontUrl,
        aadhaar_back_uri: backUrl,
        selfie_uri: selfieUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (docsError) {
      console.error('Error saving verification documents:', docsError);
      throw new Error(`We couldn't save your documents (${docsError.message}). Please try again.`);
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        verification_status: 'pending',
        verification_submitted_at: new Date().toISOString(),
        verification_rejection_reason: null,
      })
      .eq('id', userId);

    if (error) {
      console.error('Error submitting verification:', error);
      throw new Error(`We couldn't submit your verification (${error.message}). Please try again.`);
    }

    await refreshProfile();
    const { data: refreshedRow } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (refreshedRow) {
      const refreshedUser = mapProfileRowToUser(refreshedRow);
      setUsers((prev) => prev.map((user) => (user.id === userId ? refreshedUser : user)));
    }
  };

  // Dev-only: lets a tester flip verification status without a real review pipeline.
  // Only ever called from UI gated behind DEV_TOOLS_ENABLED (see lib/devTools.ts).
  const setVerificationStatusDev = (status: VerificationStatus, reason?: string) => {
    if (!currentUser) return;
    const userId = currentUser.id;

    (async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          verification_status: status,
          verification_rejection_reason: status === 'rejected' ? (reason ?? null) : null,
          verified: status === 'approved',
        })
        .eq('id', userId);

      if (error) {
        console.error('Error setting dev verification status:', error);
        return;
      }

      await refreshProfile();
      const { data: refreshedRow } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (refreshedRow) {
        const refreshedUser = mapProfileRowToUser(refreshedRow);
        setUsers((prev) => prev.map((user) => (user.id === userId ? refreshedUser : user)));
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

    setRawEvents((prev) => upsertById(prev, event, true));
    updateCurrentUserUsage((user) => {
      const shouldSpendCredit = usage.monetisationEnabled && (user.plansCreatedThisMonth ?? 0) >= FREE_CREATE_LIMIT;
      return {
        ...user,
        plansCreatedThisMonth: (user.plansCreatedThisMonth ?? 0) + 1,
        credits: shouldSpendCredit ? Math.max((user.credits ?? 0) - 1, 0) : user.credits ?? 0,
        totalCreditsSpent: shouldSpendCredit ? (user.totalCreditsSpent ?? 0) + 1 : user.totalCreditsSpent ?? 0,
      };
    });

    triggerSafetyTips();

    return event;
  };

  // Only the start time (same day) and the description can change after posting; the
  // restrict_event_edits() trigger (migration 017) enforces that, and members are notified of a
  // new time server-side. exactTime / timeSlot are dateTime's display labels and move with it.
  const updateEvent = async (eventId: string, data: EventEdit): Promise<void> => {
    const previous = rawEvents.find((event) => event.id === eventId);
    setRawEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, ...data } : event)));

    const { error } = await supabase
      .from('events')
      .update({
        description: data.description,
        date_time: data.dateTime,
        exact_time: data.exactTime,
        time_slot: data.timeSlot,
      })
      .eq('id', eventId);

    if (error) {
      console.error('Error updating event:', error);
      if (previous) {
        setRawEvents((prev) => prev.map((event) => (event.id === eventId ? previous : event)));
      }
      throw new Error(error.message);
    }
  };

  const deleteEvent = (eventId: string) => {
    const previousEvent = rawEvents.find((event) => event.id === eventId);
    const previousRequests = requests.filter((request) => request.eventId === eventId);
    const previousMessages = messages[eventId];

    setRawEvents((prev) => prev.filter((event) => event.id !== eventId));
    setRequests((prev) => prev.filter((request) => request.eventId !== eventId));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });

    (async () => {
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId);
      if (error) {
        console.error('Error deleting event:', error);
        if (previousEvent) {
          setRawEvents((prev) => upsertById(prev, previousEvent, true));
          setRequests((prev) => previousRequests.reduce((list, request) => upsertById(list, request), prev));
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

    // Guards against double-tap / re-entrant calls firing two inserts before
    // local `requests` state has updated from the first one.
    const dedupeKey = `${eventId}:${currentUser.id}`;
    if (pendingJoinEventIds.current.has(dedupeKey)) {
      return;
    }
    pendingJoinEventIds.current.add(dedupeKey);

    try {
      const event = events.find((item) => item.id === eventId);
      if (event?.womenOnly && currentUser.gender !== 'woman') {
        throw new Error('This is a women-only plan.');
      }

      if (event?.maxPeople && event.approvedUserIds.length + 1 >= event.maxPeople) {
        throw new Error('This plan is already full.');
      }

      if (event && new Date(event.dateTime).getTime() < Date.now()) {
        throw new Error('This plan has already happened.');
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
        attempts: 1,
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
        if (error.code === '23505') {
          // A request already exists server-side (e.g. a prior tap already went
          // through before local state caught up). Sync from the DB instead of
          // erroring out the user.
          const { data: existingRow } = await supabase
            .from('join_requests')
            .select('id, status, attempts, created_at')
            .eq('user_id', currentUser.id)
            .eq('event_id', eventId)
            .maybeSingle();

          if (existingRow) {
            setRequests((prev) =>
              upsertById(prev, {
                id: existingRow.id,
                userId: currentUser.id,
                eventId,
                status: existingRow.status as RequestStatus,
                attempts: existingRow.attempts ?? 1,
                createdAt: existingRow.created_at,
              })
            );
          }
          return;
        }

        console.error('Error creating join request:', error);
        throw new Error(error.message);
      }

      // upsert, not append: the realtime echo of this same insert may already have landed.
      setRequests((prev) => upsertById(prev, nextRequest));
      chargeJoinRequest(usage.monetisationEnabled);
    } finally {
      pendingJoinEventIds.current.delete(dedupeKey);
    }
  };

  const chargeJoinRequest = (monetisationOn: boolean) => {
    updateCurrentUserUsage((user) => {
      const freeJoinLimit = FREE_JOIN_LIMIT + (user.verified ? VERIFIED_JOIN_BONUS : 0);
      const nextUsed = (user.joinRequestsThisMonth ?? 0) + 1;
      const shouldSpendCredit = monetisationOn && (user.joinRequestsThisMonth ?? 0) >= freeJoinLimit;

      return {
        ...user,
        joinRequestsThisMonth: nextUsed,
        credits: shouldSpendCredit ? Math.max((user.credits ?? 0) - 1, 0) : user.credits ?? 0,
        totalCreditsSpent: shouldSpendCredit ? (user.totalCreditsSpent ?? 0) + 1 : user.totalCreditsSpent ?? 0,
      };
    });
  };

  // Sends a declined request again (rejected -> pending on the same row). The attempt limit
  // is enforced server-side by rerequest_to_join() (migration 013); the checks here only
  // give a friendlier message before the round trip.
  const rerequestToJoin = async (eventId: string): Promise<void> => {
    if (!currentUser) {
      return;
    }
    const existing = requests.find((request) => request.eventId === eventId && request.userId === currentUser.id);
    if (!existing || existing.status !== 'rejected') {
      return;
    }
    if ((existing.attempts ?? 1) >= MAX_JOIN_REQUEST_ATTEMPTS) {
      throw new Error('You have used all your requests for this plan.');
    }

    const dedupeKey = `${eventId}:${currentUser.id}`;
    if (pendingJoinEventIds.current.has(dedupeKey)) {
      return;
    }
    pendingJoinEventIds.current.add(dedupeKey);

    try {
      const event = events.find((item) => item.id === eventId);
      if (event?.maxPeople && event.approvedUserIds.length + 1 >= event.maxPeople) {
        throw new Error('This plan is already full.');
      }

      const usage = getUsageSummaryForUser(currentUser);
      if (usage.monetisationEnabled && usage.joinLimitReached) {
        return;
      }

      const { data, error } = await supabase.rpc('rerequest_to_join', { p_event_id: eventId });
      if (error) {
        console.error('Error re-sending join request:', error);
        throw new Error(error.message);
      }

      const attempts = typeof data === 'number' ? data : (existing.attempts ?? 1) + 1;
      setRequests((prev) =>
        prev.map((request) => (request.id === existing.id ? { ...request, status: 'pending', attempts } : request))
      );
      chargeJoinRequest(usage.monetisationEnabled);
    } finally {
      pendingJoinEventIds.current.delete(dedupeKey);
    }
  };

  const getRequestAttempts = (eventId: string) => {
    if (!currentUser) {
      return 0;
    }
    const request = requests.find((item) => item.eventId === eventId && item.userId === currentUser.id);
    return request ? request.attempts ?? 1 : 0;
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
  };

  // Host takes an approved member off the plan. 'removed' is final: they lose chat/details
  // access (RLS only admits 'approved') and can't request this plan again.
  const removeMember = async (eventId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('join_requests')
      .update({ status: 'removed' })
      .eq('user_id', userId)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error removing member:', error);
      throw new Error(error.message);
    }

    setRequests((prev) =>
      prev.map((request) =>
        request.eventId === eventId && request.userId === userId ? { ...request, status: 'removed' } : request
      )
    );
  };

  // Host invites an accepted crew member. invite_to_event() (migration 014) checks host, crew,
  // full / started / women-only, and creates an 'invited' row that grants nothing until the
  // invitee accepts via respondToInvite.
  // Anyone in a plan can report another person in it (report_member(), migration 018). The host
  // is notified unless the report is about them, in which case only admins see it.
  const reportMember = async (eventId: string, userId: string, reason: string): Promise<void> => {
    const { error } = await supabase.rpc('report_member', { p_event_id: eventId, p_reported_id: userId, p_reason: reason });
    if (error) {
      console.error('Error reporting member:', error);
      throw new Error(error.message);
    }
  };

  // Host's decision on open reports about a member: remove them (same as Remove) or dismiss.
  const resolveMemberReports = async (eventId: string, userId: string, remove: boolean): Promise<void> => {
    const { error } = await supabase.rpc('resolve_member_reports', {
      p_event_id: eventId,
      p_reported_id: userId,
      p_remove: remove,
    });
    if (error) {
      console.error('Error resolving reports:', error);
      throw new Error(error.message);
    }
    if (remove) {
      setRequests((prev) =>
        prev.map((request) =>
          request.eventId === eventId && request.userId === userId && request.status === 'approved'
            ? { ...request, status: 'removed' }
            : request
        )
      );
    }
  };

  const inviteToEvent = async (eventId: string, userId: string): Promise<void> => {
    const { error } = await supabase.rpc('invite_to_event', { p_event_id: eventId, p_user_id: userId });
    if (error) {
      console.error('Error creating invite:', error);
      throw new Error(error.message);
    }

    const { data: row } = await supabase
      .from('join_requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (row) {
      setRequests((prev) => upsertById(prev, mapRequestRow(row)));
    }
  };

  // Invitee's answer. Accept makes them an approved member; decline deletes the invite row, so
  // they're back to "no request" and can still ask to join later.
  const respondToInvite = async (eventId: string, accept: boolean): Promise<void> => {
    if (!currentUser) {
      return;
    }
    const { error } = await supabase.rpc('respond_to_invite', { p_event_id: eventId, p_accept: accept });
    if (error) {
      console.error('Error responding to invite:', error);
      throw new Error(error.message);
    }

    const isMine = (request: JoinRequest) => request.eventId === eventId && request.userId === currentUser.id;
    setRequests((prev) =>
      accept
        ? prev.map((request) => (isMine(request) ? { ...request, status: 'approved' } : request))
        : prev.filter((request) => !isMine(request))
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

  // send_crew_request() (migration 014) also accepts their request if they'd already asked
  // you, and clears an old declined one, so just re-read the list afterwards.
  const sendCrewRequest = async (userId: string): Promise<void> => {
    if (!currentUser || currentUser.id === userId) {
      return;
    }
    const { error } = await supabase.rpc('send_crew_request', { p_to_user_id: userId });
    if (error) {
      console.error('Error sending crew request:', error);
      throw new Error(error.message);
    }
    await syncCrewRequests();
  };

  const respondToCrewRequest = async (requestId: string, accept: boolean): Promise<void> => {
    const previous = crewRequests.find((request) => request.id === requestId);
    const status = accept ? 'accepted' : 'rejected';
    setCrewRequests((prev) => prev.map((request) => (request.id === requestId ? { ...request, status } : request)));

    const { error } = await supabase.rpc('respond_to_crew_request', { p_request_id: requestId, p_accept: accept });
    if (error) {
      console.error('Error responding to crew request:', error);
      if (previous) {
        setCrewRequests((prev) => prev.map((request) => (request.id === requestId ? previous : request)));
      }
      throw new Error(error.message);
    }
  };

  const acceptCrewRequest = (requestId: string) => respondToCrewRequest(requestId, true);
  const rejectCrewRequest = (requestId: string) => respondToCrewRequest(requestId, false);

  // Ends a crew connection, or cancels a pending request either way. remove_from_crew()
  // (migration 015) also withdraws open invites between the two of you; people who already
  // accepted stay in the plan. The other person isn't notified.
  const removeFromCrew = async (userId: string): Promise<void> => {
    if (!currentUser) {
      return;
    }
    const { error } = await supabase.rpc('remove_from_crew', { p_user_id: userId });
    if (error) {
      console.error('Error removing from crew:', error);
      throw new Error(error.message);
    }

    const me = currentUser.id;
    const betweenUs = (request: CrewRequest) =>
      (request.fromUserId === me && request.toUserId === userId) || (request.fromUserId === userId && request.toUserId === me);
    setCrewRequests((prev) => prev.filter((request) => !betweenUs(request)));
    const hostOf = new Map(rawEvents.map((event) => [event.id, event.creatorId]));
    setRequests((prev) =>
      prev.filter(
        (request) =>
          request.status !== 'invited' ||
          !(
            (hostOf.get(request.eventId) === me && request.userId === userId) ||
            (hostOf.get(request.eventId) === userId && request.userId === me)
          )
      )
    );
  };

  // A declined request (either way) counts as no relationship: either side can ask again.
  const getCrewStatus = (userId: string) => {
    if (!currentUser) {
      return 'none';
    }

    // There can be more than one live row between two people (one each way); an accepted one
    // wins, otherwise a connected person could show up as "request sent" / "add to crew".
    const between = crewRequests.filter(
      (request) =>
        request.status !== 'rejected' &&
        ((request.fromUserId === currentUser.id && request.toUserId === userId) ||
          (request.fromUserId === userId && request.toUserId === currentUser.id))
    );
    const existing = between.find((request) => request.status === 'accepted') ?? between[0];

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

  // The global message fetch on login only sees the events the user has access
  // to *at that moment*. Access to a chat's history can change later (e.g. a
  // join request gets approved), so re-fetch a specific event's messages
  // whenever its chat is opened rather than trusting the stale global snapshot.
  const refreshEventMessages = async (eventId: string): Promise<void> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error refreshing event messages:', error);
      return;
    }

    if (!data) {
      return;
    }

    const freshMessages = data.map(mapMessageRow);
    setMessages((prev) => ({ ...prev, [eventId]: freshMessages }));
  };

  const getUserKarma = (userId: string) => karmaByUser[userId] ?? null;

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
        crewRecommendations,
        isLoadingRecommendations,
        refreshCrewRecommendations,
        isOnboardingComplete,
        isAppReady,
        lastRoute,
        recordRoute,
        shouldShowSafetyTips,
        dismissSafetyTips,
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
        submitVerification,
        setVerificationStatusDev,
        createEvent,
        updateEvent,
        deleteEvent,
        requestToJoin,
        rerequestToJoin,
        getRequestAttempts,
        approveRequest,
        rejectRequest,
        removeMember,
        reportMember,
        resolveMemberReports,
        inviteToEvent,
        respondToInvite,
        getRequestStatus,
        sendCrewRequest,
        acceptCrewRequest,
        rejectCrewRequest,
        removeFromCrew,
        getCrewStatus,
        getCrewMembers,
        sendMessage,
        refreshEventMessages,
        getUserKarma,
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
