# Toogether App - Database Schema Documentation

**Project:** Toogether - A social event discovery and meetup application
**Last Updated:** May 2026
**Tech Stack:** React Native (Expo), Supabase PostgreSQL, TypeScript

---

## 📋 Table of Contents

1. [Schema Overview](#schema-overview)
2. [Core Tables](#core-tables)
3. [Relationships & Diagram](#relationships--diagram)
4. [Data Types & Constraints](#data-types--constraints)
5. [Indexes & Performance](#indexes--performance)
6. [Security (RLS)](#security-rls)
7. [Development References](#development-references)

---

## Schema Overview

The Toogether application manages **social events** and **user connections**. The system centers around:

- **Users**: Profile information, verification, demographics
- **Events**: Meetups/activities with locations, categories, and capacity limits
- **Event Management**: Join requests, approvals, participant tracking
- **Communication**: Messages/chat within event groups
- **Social Features**: User ratings and crew connections

---

## Core Tables

### 1. **profiles** (Authentication + Profile)

**Purpose:** Store user profile information and authentication details

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  username TEXT UNIQUE,
  gender TEXT,
  age INTEGER,
  city TEXT,
  bio TEXT,
  avatar_colors TEXT[] DEFAULT ARRAY['#8B5CF6', '#6366F1'],
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**

- `id`: UUID from Supabase auth
- `username`: Handle for the app (@username) - UNIQUE constraint
- `avatar_colors`: Two-color gradient array for avatar UI (TEXT array)
- `verified`: Email verification status
- `gender`: One of 'man', 'woman', 'other'
- `age`: User's age

**Indexes:**

```sql
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_city ON public.profiles(city);
CREATE INDEX idx_profiles_verified ON public.profiles(verified);
```

**RLS Policies:**

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

### 2. **events** (Core Event Data)

**Purpose:** Store event/meetup information

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('movies', 'chill', 'music', 'sports',
                        'food', 'travel', 'gaming', 'other')),
  emoji VARCHAR(10) NOT NULL,
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  time_slot VARCHAR(50) NOT NULL
    CHECK (time_slot IN ('Morning', 'Afternoon', 'Evening', 'Night')),
  exact_time VARCHAR(50) NOT NULL,
  area VARCHAR(255) NOT NULL,
  exact_location TEXT NOT NULL,
  location_note TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  map_url TEXT,
  max_people INT,
  women_only BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Key Fields:**

- `creator_id`: Foreign key to profiles table (event organizer)
- `category`: Event type classification
- `date_time`: ISO datetime for the event
- `latitude/longitude`: GPS coordinates for location-based queries
- `max_people`: Capacity limit (NULL = unlimited)
- `women_only`: Safety feature for women-only events

**Indexes:**

```sql
CREATE INDEX idx_events_creator ON events(creator_id);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_datetime ON events(date_time);
CREATE INDEX idx_events_location ON events(area);
CREATE INDEX idx_events_geo ON events(latitude, longitude);
```

---

### 3. **join_requests** (Event Participation Workflow)

**Purpose:** Track user requests to join events and approval status

```sql
CREATE TABLE join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, event_id)
);
```

**Key Fields:**

- `user_id`: User requesting to join
- `event_id`: Event they want to join
- `status`: Request lifecycle (pending → approved/rejected)

**Indexes:**

```sql
CREATE INDEX idx_join_requests_user ON join_requests(user_id);
CREATE INDEX idx_join_requests_event ON join_requests(event_id);
CREATE INDEX idx_join_requests_status ON join_requests(status);
```

---

### 4. **messages** (Event Chat/Messaging)

**Purpose:** Store chat messages for event groups

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Key Fields:**

- `event_id`: Event chat group
- `user_id`: Message sender
- `text`: Message content
- `created_at`: Message timestamp

**Indexes:**

```sql
CREATE INDEX idx_messages_event ON messages(event_id);
CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

---

### 5. **ratings** (Post-Event Reviews)

**Purpose:** Track user ratings and reviews after events

```sql
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, event_id)
);
```

**Key Fields:**

- `from_user_id`: Rating giver
- `to_user_id`: Rating recipient
- `event_id`: Context event
- `stars`: 1-5 star rating
- `comment`: Optional review text

**Indexes:**

```sql
CREATE INDEX idx_ratings_from_user ON ratings(from_user_id);
CREATE INDEX idx_ratings_to_user ON ratings(to_user_id);
CREATE INDEX idx_ratings_event ON ratings(event_id);
```

---

### 6. **crew_requests** (Friend Requests / Connections)

**Purpose:** Manage friend/crew connection requests

```sql
CREATE TABLE crew_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);
```

**Key Fields:**

- `from_user_id`: Request initiator
- `to_user_id`: Request recipient
- `status`: Connection status

**Indexes:**

```sql
CREATE INDEX idx_crew_requests_from ON crew_requests(from_user_id);
CREATE INDEX idx_crew_requests_to ON crew_requests(to_user_id);
CREATE INDEX idx_crew_requests_status ON crew_requests(status);
```

---

## Relationships & Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       profiles                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ id (PK) | email | username | name | age | gender | city │   │
│  │ avatar_colors | bio | verified | created_at            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ▲                    ▲                        ▲
         │ (creator_id)       │ (user_id)             │ (user_id)
         │                    │                        │
    ┌────┴────────────────────┴─────────────────────────┴──────┐
    │                                                           │
    │        ┌──────────────────────────────────┐              │
    │        │         events                   │              │
    │        │  ┌──────────────────────────┐    │              │
    │        │  │ id (PK)                  │    │              │
    │        │  │ title, description       │    │              │
    │        │  │ creator_id (FK→users)    │    │              │
    │        │  │ category, emoji          │    │              │
    │        │  │ date_time                │    │              │
    │        │  │ latitude, longitude      │    │              │
    │        │  │ max_people, women_only   │    │              │
    │        │  └──────────────────────────┘    │              │
    │        └──────────────────────────────────┘              │
    │             ▲              ▲              ▲              │
    │             │ (event_id)   │ (event_id)   │ (event_id)   │
    │             │              │              │              │
    │        ┌────┴────┐  ┌──────┴────┐  ┌────┴──────┐         │
    │        │          │  │           │  │           │         │
    │   ┌────┴───────┐  │  │ ┌──────────┐│  │┌───────────┐     │
    │   │ join_      │  │  │ │ messages │   │ ratings   │      │
    │   │ requests   │  │  │ └──────────┘   └───────────┘      │
    │   │            │  │  │                                    │
    │   │ user_id────┼──┼──┘  user_id─────┐  from_user_id─┐   │
    │   │ event_id───┘  │     event_id     │  to_user_id───┼───┤
    │   │ status     ┌──┘     text         │  stars         │   │
    │   └────────────┘        created_at   │  comment       │   │
    │                                       └────────────────┘   │
    │                                                            │
    │   ┌─────────────────────────────────────────────────┐    │
    │   │        crew_requests                            │    │
    │   │  ┌─────────────────────────────────────────┐    │    │
    │   └──│ id (PK)                                 │────┘    │
        │ from_user_id (FK→users)     ◄──────────┘
        │ to_user_id (FK→users)       ◄──────────┘
        │ status (pending/accepted)                 │
        └─────────────────────────────────────────┘
```

### Relationship Summary

| From Table    | To Table | Type                    | Via Column   |
| ------------- | -------- | ----------------------- | ------------ |
| events        | users    | Many-to-One             | creator_id   |
| join_requests | events   | Many-to-One             | event_id     |
| join_requests | users    | Many-to-One             | user_id      |
| messages      | events   | Many-to-One             | event_id     |
| messages      | users    | Many-to-One             | user_id      |
| ratings       | users    | Many-to-One (giver)     | from_user_id |
| ratings       | users    | Many-to-One (recipient) | to_user_id   |
| ratings       | events   | Many-to-One             | event_id     |
| crew_requests | users    | Many-to-One (initiator) | from_user_id |
| crew_requests | users    | Many-to-One (recipient) | to_user_id   |

---

## Data Types & Constraints

### Enumerations

**Category** (event types):

- `movies` - Film screenings, movie nights
- `chill` - Casual hangouts, coffee meetups
- `music` - Concerts, jam sessions
- `sports` - Athletic activities, games
- `food` - Dining, food events
- `travel` - Trips, road trips
- `gaming` - Video games, board games
- `other` - Miscellaneous

**Time Slot** (event time periods):

- `Morning` - 6 AM - 12 PM
- `Afternoon` - 12 PM - 6 PM
- `Evening` - 6 PM - 12 AM
- `Night` - 12 AM - 6 AM

**Gender**:

- `man`
- `woman`
- `other`

**Request Status**:

- `pending` - Awaiting response
- `approved` - Accepted
- `rejected` - Declined

**Crew Status**:

- `pending` - Awaiting response
- `accepted` - Connection established
- `rejected` - Declined

### Constraints & Validations

| Table         | Column                               | Constraint                | Notes                                           |
| ------------- | ------------------------------------ | ------------------------- | ----------------------------------------------- |
| users         | age                                  | 13 - 120                  | Minimum age compliance                          |
| users         | username                             | UNIQUE                    | Handle uniqueness                               |
| users         | email                                | UNIQUE                    | One email per account                           |
| ratings       | stars                                | 1 - 5                     | Star rating range                               |
| join_requests | status                               | pending/approved/rejected | Lifecycle states                                |
| crew_requests | status                               | pending/accepted/rejected | Connection states                               |
| events        | date_time                            | Future timestamp          | Events scheduled ahead                          |
| join_requests | (user_id, event_id)                  | UNIQUE                    | One request per user per event                  |
| crew_requests | (from_user_id, to_user_id)           | UNIQUE                    | One request per user pair                       |
| ratings       | (from_user_id, to_user_id, event_id) | UNIQUE                    | One rating per reviewer per recipient per event |

---

## Indexes & Performance

### Query Optimization Strategy

**For Feed Discovery:**

```sql
-- Get events by location and date
CREATE INDEX idx_events_search ON events(area, date_time DESC, category)
  WHERE date_time > now();
```

**For User Profiles:**

```sql
-- Get user's created events
CREATE INDEX idx_events_creator_active ON events(creator_id, date_time DESC)
  WHERE date_time > now();
```

**For Event Participation:**

```sql
-- Get pending join requests for event creator
CREATE INDEX idx_join_requests_pending ON join_requests(event_id, status)
  WHERE status = 'pending';

-- Get user's approved events
CREATE INDEX idx_join_requests_user_approved ON join_requests(user_id, status)
  WHERE status = 'approved';
```

**For Messaging:**

```sql
-- Get recent messages for an event
CREATE INDEX idx_messages_recent ON messages(event_id, created_at DESC);
```

**For User Ratings:**

```sql
-- Get average ratings for a user
CREATE INDEX idx_ratings_received ON ratings(to_user_id);
```

### Performance Queries

```sql
-- Get event feed (pagination-friendly)
SELECT e.*, COUNT(DISTINCT jr.user_id) as participant_count
FROM events e
LEFT JOIN join_requests jr ON e.id = jr.event_id AND jr.status = 'approved'
WHERE e.date_time > now()
  AND e.area = $area
  AND e.category = $category
ORDER BY e.date_time ASC
LIMIT 20 OFFSET $offset;

-- Get user's upcoming events
SELECT e.*
FROM events e
INNER JOIN join_requests jr ON e.id = jr.event_id
WHERE jr.user_id = $user_id
  AND jr.status = 'approved'
  AND e.date_time > now()
ORDER BY e.date_time ASC;

-- Get user rating average
SELECT to_user_id, AVG(stars) as avg_rating, COUNT(*) as total_ratings
FROM ratings
WHERE to_user_id = $user_id
GROUP BY to_user_id;
```

---

## Security (RLS)

### Row-Level Security Policies

**Users Table:**

```sql
-- Users can view all profiles (no sensitive data exposed)
CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can only insert their own profile
CREATE POLICY "users_insert_own" ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
```

**Events Table:**

```sql
-- Everyone can view events
CREATE POLICY "events_select_all" ON events FOR SELECT USING (true);

-- Only creator can update their event
CREATE POLICY "events_update_creator" ON events FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Only creator can delete their event
CREATE POLICY "events_delete_creator" ON events FOR DELETE
  USING (auth.uid() = creator_id);

-- Any authenticated user can create events
CREATE POLICY "events_insert_authenticated" ON events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

**Join Requests Table:**

```sql
-- Users can view their own join requests
CREATE POLICY "join_requests_select_own" ON join_requests FOR SELECT
  USING (auth.uid() = user_id OR
         EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()));

-- Users can only create join requests for themselves
CREATE POLICY "join_requests_insert_own" ON join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only event creator can update join requests
CREATE POLICY "join_requests_update_creator" ON join_requests FOR UPDATE
  USING (EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()));
```

**Messages Table:**

```sql
-- Users can view messages from events they joined
CREATE POLICY "messages_select_approved" ON messages FOR SELECT
  USING (EXISTS(SELECT 1 FROM events e
         LEFT JOIN join_requests jr ON e.id = jr.event_id
         WHERE e.id = messages.event_id
         AND (e.creator_id = auth.uid() OR
              (jr.user_id = auth.uid() AND jr.status = 'approved'))));

-- Users can only create messages for events they joined
CREATE POLICY "messages_insert_approved" ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND
              EXISTS(SELECT 1 FROM events e
              LEFT JOIN join_requests jr ON e.id = jr.event_id
              WHERE e.id = messages.event_id
              AND (e.creator_id = auth.uid() OR
                   (jr.user_id = auth.uid() AND jr.status = 'approved'))));
```

**Ratings Table:**

```sql
-- Anyone can view ratings
CREATE POLICY "ratings_select_all" ON ratings FOR SELECT USING (true);

-- Users can only create ratings for events they participated in
CREATE POLICY "ratings_insert_participated" ON ratings FOR INSERT
  WITH CHECK (auth.uid() = from_user_id AND
              EXISTS(SELECT 1 FROM join_requests
              WHERE event_id = ratings.event_id
              AND user_id = ratings.to_user_id
              AND status = 'approved'));

-- Users can only update their own ratings
CREATE POLICY "ratings_update_own" ON ratings FOR UPDATE
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);
```

**Crew Requests Table:**

```sql
-- Users can view their own crew requests
CREATE POLICY "crew_requests_select_own" ON crew_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can only send crew requests for themselves
CREATE POLICY "crew_requests_insert_own" ON crew_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Only recipient can accept/reject
CREATE POLICY "crew_requests_update_recipient" ON crew_requests FOR UPDATE
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);
```

---

## Development References

### Environment Setup

**Required Supabase Configuration:**

1. Create database tables (use SQL from above)
2. Enable Row-Level Security on all tables
3. Create policies (see Security section)
4. Set up auth with Email provider

**Environment Variables:**

```
EXPO_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
EXPO_PUBLIC_SUPABASE_KEY=eyJhbGc...
```

### Frontend Integration Points

**User Management** (`utils/supabase.ts`):

- Authentication via Supabase Auth
- AsyncStorage for token persistence
- Session management

**Data Fetching** (hooks/useEvents.ts, hooks/useProfile.ts):

- React Query for server state management
- Real-time subscriptions available

**Store Management** (`store/authStore.ts`, `store/feedStore.ts`):

- Zustand for local state
- User profile cache
- Feed/event feed state

### TypeScript Interfaces (from `lib/types.ts`)

```typescript
// Core application types
interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarColors: [string, string];
  avatarUri?: string;
  gender: "woman" | "man" | "other";
  age: number;
  city: string;
  verified?: boolean;
  bio?: string;
}

interface Event {
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

interface JoinRequest {
  id: string;
  userId: string;
  eventId: string;
  status: RequestStatus;
  createdAt: string;
}

interface Message {
  id: string;
  eventId: string;
  userId: string;
  text: string;
  createdAt: string;
}

interface Rating {
  id: string;
  fromUserId: string;
  toUserId: string;
  eventId: string;
  stars: number;
  createdAt: string;
}

interface CrewRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

type EventCategory =
  | "movies"
  | "chill"
  | "music"
  | "sports"
  | "food"
  | "travel"
  | "gaming"
  | "other";

type RequestStatus = "pending" | "approved" | "rejected";
```

### Common Queries to Implement

**Discovery Feed:**

```typescript
// Get events in user's city by category
const getEventsFeed = async (userId: string, category?: string) => {
  let query = supabase
    .from("events")
    .select("*")
    .gt("date_time", new Date().toISOString())
    .order("date_time", { ascending: true });

  if (category) query = query.eq("category", category);

  return query;
};
```

**Event Details with Participants:**

```typescript
const getEventDetails = async (eventId: string) => {
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  const { data: participants } = await supabase
    .from("join_requests")
    .select("user_id, status")
    .eq("event_id", eventId)
    .eq("status", "approved");

  return { event, participants };
};
```

**User Profile with Stats:**

```typescript
const getUserProfile = async (userId: string) => {
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  const { data: ratings } = await supabase
    .from("ratings")
    .select("stars")
    .eq("to_user_id", userId);

  const avgRating = ratings?.length
    ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length
    : null;

  return { user, avgRating, ratingCount: ratings?.length || 0 };
};
```

### Testing Data

Mock data available in `lib/mockData.ts`:

- 5 sample users (diverse profiles)
- 5 sample events (various categories & times)
- Sample join requests, messages, ratings

---

## Future Enhancements

### Potential Future Tables

**Blocked Users:**

```sql
CREATE TABLE blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
```

**Event Attendance Tracking:**

```sql
CREATE TABLE event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(event_id, user_id)
);
```

**Push Notifications:**

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, token)
);
```

**Activity Log:**

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## Quick Reference

### Essential SQL Exports

**Create all tables:**

```bash
# Export from this documentation and run in Supabase SQL editor
# or use Supabase migrations
supabase migration new create_core_schema
```

**Enable RLS:**

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_requests ENABLE ROW LEVEL SECURITY;
```

### File References in Codebase

| File                                       | Purpose                        |
| ------------------------------------------ | ------------------------------ |
| [utils/supabase.ts](utils/supabase.ts)     | Supabase client initialization |
| [lib/types.ts](lib/types.ts)               | TypeScript type definitions    |
| [lib/mockData.ts](lib/mockData.ts)         | Mock data for development      |
| [hooks/useEvents.ts](hooks/useEvents.ts)   | Event data fetching            |
| [hooks/useProfile.ts](hooks/useProfile.ts) | User profile fetching          |
| [store/authStore.ts](store/authStore.ts)   | Auth state management          |

---

## Support & Updates

**Last Modified:** May 25, 2026
**Schema Version:** 1.0
**Compatibility:** Supabase PostgreSQL 15+

For questions about schema implementation, refer to:

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- Project type definitions in `lib/types.ts`
