export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarColors: string[];
  avatarUri?: string;
  gender: 'woman' | 'man' | 'other';
  age: number;
  dob?: string;
  city?: string;
  verified?: boolean;
  credits?: number;
  joinRequestsThisMonth?: number;
  plansCreatedThisMonth?: number;
  totalCreditsEarned?: number;
  totalCreditsSpent?: number;
  verificationBonusGranted?: boolean;
  verificationStatus?: VerificationStatus;
  verificationSubmittedAt?: string;
  verificationRejectionReason?: string;
}

export type EventCategory =
  | "movies"
  | "chill"
  | "music"
  | "sports"
  | "food"
  | "travel"
  | "gaming"
  | "other";

export interface Event {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  area: string;
  timeSlot: "Morning" | "Afternoon" | "Evening" | "Night";
  exactTime: string;
  exactLocation: string;
  locationNote?: string;
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
  location: string;
  creatorId: string;
  maxPeople?: number;
  approvedUserIds: string[];
  requestUserIds: string[];
  category: EventCategory;
  emoji: string;
  womenOnly?: boolean;
  pinned?: boolean;
}

// 'removed' = the host took an approved member off the plan; final, can't be re-requested.
// 'invited' = the host invited them (crew only); nothing is granted until they accept.
export type RequestStatus = "pending" | "approved" | "rejected" | "removed" | "invited";

// A declined requester can try again until they've sent this many requests in total.
export const MAX_JOIN_REQUEST_ATTEMPTS = 3;

export interface JoinRequest {
  id: string;
  userId: string;
  eventId: string;
  status: RequestStatus;
  // How many times this request has been sent (1 on the first request).
  attempts?: number;
  createdAt: string;
}

export interface Message {
  id: string;
  eventId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Rating {
  id: string;
  fromUserId: string;
  toUserId: string;
  eventId: string;
  stars: number;
  createdAt: string;
}

export interface CrewRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export type NotificationType =
  | "join_request_received"
  | "join_request_approved"
  | "join_request_rejected"
  | "join_request_removed"
  | "event_invite_received"
  | "event_invite_accepted"
  | "event_invite_declined"
  | "event_time_changed"
  | "member_reported"
  | "crew_request_received"
  | "crew_request_accepted"
  | "verification_approved"
  | "verification_rejected"
  | "new_message";

// A report about someone in a plan (migration 018). The host sees reports about their members;
// a reporter sees their own; reports about the host go to admins only.
export interface MemberReport {
  id: string;
  eventId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: "removed" | "dismissed" | null;
}

export const REPORT_REASON_LIMITS = { min: 10, max: 500 } as const;

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { route?: string; eventId?: string; actorId?: string };
  readAt: string | null;
  createdAt: string;
}

export interface CategoryTheme {
  label: string;
  chipBackground: string;
  chipText: string;
  iconBackground: string;
}
