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
  bio?: string;
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

export type RequestStatus = "pending" | "approved" | "rejected";

export interface JoinRequest {
  id: string;
  userId: string;
  eventId: string;
  status: RequestStatus;
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
  | "verification_approved"
  | "verification_rejected"
  | "new_message";

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
