export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarColors: string[];
  avatarUri?: string;
  gender: "woman" | "man" | "other";
  age: number;
  city?: string;
  verified?: boolean;
  bio?: string;
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

export interface CategoryTheme {
  label: string;
  chipBackground: string;
  chipText: string;
  iconBackground: string;
}
