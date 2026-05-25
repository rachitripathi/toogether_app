# Toogether App - Database Documentation Index

**Complete Reference for Toogether Backend Architecture & Schema**

---

## 📚 Documentation Overview

This directory contains comprehensive database documentation for the Toogether app, a social event discovery and meetup platform.

### Quick Navigation

| Document                    | Purpose                                    | Audience               |
| --------------------------- | ------------------------------------------ | ---------------------- |
| **SCHEMA_DOCUMENTATION.md** | Complete schema reference with ER diagrams | Architects, DBAs       |
| **API_REFERENCE.md**        | TypeScript/JavaScript query examples       | Developers             |
| **SETUP_GUIDE.md**          | Deployment & configuration guide           | DevOps, New developers |
| **DATABASE_INDEX.md**       | This file - quick reference                | Everyone               |

---

## 🏗️ Project Architecture

### Technology Stack

```
Frontend:  React Native (Expo)
Backend:   Supabase (PostgreSQL)
Auth:      Supabase Auth (Email)
State:     Zustand + React Query
Location:  Expo Location + React Native Maps
```

### Core Application Modules

```
app/
├── Authentication (auth.tsx, onboarding.tsx)
├── Event Discovery (home.tsx, [id].tsx)
├── Event Creation (create-event.tsx)
├── Chat/Messaging (chat/[id].tsx)
├── User Profiles (profile.tsx, user/[id].tsx)
└── Activity Feed (activity.tsx, people.tsx)

hooks/
├── useEvents       → Event data fetching
├── useFeed         → Feed discovery
├── useProfile      → User profiles
└── useCollapsibleHeader

store/
├── authStore       → User auth state
└── feedStore       → Event feed state
```

---

## 📊 Data Model Overview

### Core Entities

```
USER
├── Profile Information (name, age, gender, city)
├── Authentication (email, verified status)
├── Social (avatar, bio)
└── Metadata (created_at, updated_at)

EVENT
├── Details (title, description, category)
├── Scheduling (date_time, time_slot)
├── Location (area, exact_location, latitude/longitude)
├── Participation (creator, max_people, approved/pending users)
├── Settings (women_only, pinned)
└── Metadata (created_at, updated_at)

JOIN_REQUEST
├── Event Participation Flow
├── Status (pending → approved/rejected)
└── Timestamps

MESSAGE
├── Event Chat
├── User-generated content
└── Real-time capable

RATING
├── User Reviews (1-5 stars)
├── Context (which event, who rated whom)
└── Comments (optional)

CREW_REQUEST
├── Friend Connections
├── Status (pending → accepted/rejected)
└── Bidirectional relationship
```

### Data Volume Estimates

```
Users:              1,000 - 10,000+
Events:             100 - 1,000+
Join Requests:      1,000 - 100,000+
Messages:           10,000 - 1,000,000+
Ratings:            1,000 - 100,000+
Crew Requests:      1,000 - 100,000+
```

---

## 🔗 Key Relationships

### Event Participation Flow

```
1. USER creates EVENT
   └─ User becomes creator_id

2. OTHER USERS browse events
   └─ View EVENT details

3. USER sends JOIN_REQUEST
   └─ Status: pending

4. EVENT CREATOR approves/rejects
   └─ JOIN_REQUEST.status → approved/rejected

5. APPROVED users can:
   ├─ Send MESSAGES
   ├─ View event MESSAGES
   └─ After event: Give RATINGS
```

### Social Connection Flow

```
1. USER A sends CREW_REQUEST to USER B
   └─ Status: pending

2. USER B accepts/rejects
   └─ CREW_REQUEST.status → accepted/rejected

3. ACCEPTED connections enable:
   ├─ See connection badge
   ├─ Prioritize in recommendations
   └─ Direct messaging (future)
```

### Rating System

```
1. Event completes (date_time passed)

2. Participants can RATE each other
   ├─ Requires: shared event attendance
   ├─ Rating: 1-5 stars
   └─ Optional: comment/review

3. User profile shows RATING statistics
   ├─ Average rating
   ├─ Total ratings count
   └─ Rating distribution
```

---

## 📋 Table Reference

### users

```
id (UUID)              → Primary Key, FK to auth.users
email (VARCHAR)        → Unique email address
username (VARCHAR)     → Unique handle
name (VARCHAR)         → Display name
age (INT)             → Age validation (13-120)
gender (VARCHAR)       → man / woman / other
city (VARCHAR)        → Location (index for searches)
bio (TEXT)            → User bio/description
avatar_uri (TEXT)     → Optional image URL
avatar_colors (JSONB) → Gradient colors for avatar
verified (BOOLEAN)    → Email verification status
created_at (TIMESTAMP) → Account creation date
updated_at (TIMESTAMP) → Last update date
```

**Indexes:** username, city, verified

### events

```
id (UUID)              → Primary Key
title (VARCHAR)        → Event name
description (TEXT)     → Event details
creator_id (UUID)      → FK to users
category (VARCHAR)     → Event type (8 categories)
emoji (VARCHAR)        → Category emoji icon
date_time (TIMESTAMP)  → Event date/time
time_slot (VARCHAR)    → Morning/Afternoon/Evening/Night
exact_time (VARCHAR)   → HH:MM format
area (VARCHAR)        → Area/neighborhood (index)
exact_location (TEXT)  → Full address
location_note (TEXT)   → Additional location info
latitude (DECIMAL)     → GPS latitude
longitude (DECIMAL)    → GPS longitude
map_url (TEXT)        → Google Maps URL
max_people (INT)      → Capacity limit (null = unlimited)
women_only (BOOLEAN)   → Safety filter
pinned (BOOLEAN)       → Featured in feed
created_at (TIMESTAMP) → Created date
updated_at (TIMESTAMP) → Updated date
```

**Indexes:** creator, category, datetime, location, geo_location, search

### join_requests

```
id (UUID)              → Primary Key
user_id (UUID)         → FK to users (who wants to join)
event_id (UUID)        → FK to events
status (VARCHAR)       → pending / approved / rejected
created_at (TIMESTAMP) → Request date
updated_at (TIMESTAMP) → Updated date
UNIQUE(user_id, event_id) → One request per user per event
```

**Indexes:** user, event, status, pending, user_approved

### messages

```
id (UUID)              → Primary Key
event_id (UUID)        → FK to events
user_id (UUID)         → FK to users (sender)
text (TEXT)           → Message content
created_at (TIMESTAMP) → Sent date
updated_at (TIMESTAMP) → Edited date
```

**Indexes:** event, user, created_at, recent_messages

### ratings

```
id (UUID)              → Primary Key
from_user_id (UUID)    → FK to users (rater)
to_user_id (UUID)      → FK to users (rated user)
event_id (UUID)        → FK to events (context)
stars (INT)           → 1-5 star rating
comment (TEXT)        → Optional review text
created_at (TIMESTAMP) → Rating date
UNIQUE(from_user_id, to_user_id, event_id) → One per pair per event
```

**Indexes:** from_user, to_user, event, received

### crew_requests

```
id (UUID)              → Primary Key
from_user_id (UUID)    → FK to users (sender)
to_user_id (UUID)      → FK to users (recipient)
status (VARCHAR)       → pending / accepted / rejected
created_at (TIMESTAMP) → Request date
updated_at (TIMESTAMP) → Updated date
UNIQUE(from_user_id, to_user_id) → One request per pair
```

**Indexes:** from_user, to_user, status

---

## 🔐 Security Features

### Row-Level Security (RLS)

All tables have RLS enabled with policies:

- **users:** View all, update own
- **events:** View all, create authenticated, update/delete creator only
- **join_requests:** Creator can manage, user can request
- **messages:** View if participant, send if participant
- **ratings:** View all, create if participated, update own
- **crew_requests:** View own, manage if recipient

### Authentication Flow

```
1. Sign up with email
2. Verify email
3. Get JWT token
4. Store in AsyncStorage (mobile) / localStorage (web)
5. Auto-refresh on token expiry
6. Session persists across app restarts
```

---

## 🚀 Performance Optimizations

### Indexes Created

| Index                     | Purpose          | Query Pattern                    |
| ------------------------- | ---------------- | -------------------------------- |
| `idx_users_username`      | Search users     | `username LIKE`                  |
| `idx_users_city`          | Location filter  | `city =`                         |
| `idx_events_category`     | Category filter  | `category =`                     |
| `idx_events_datetime`     | Date sorting     | `date_time > NOW()` ORDER BY     |
| `idx_events_geo`          | Location search  | `latitude, longitude` NEAR       |
| `idx_join_requests_event` | Get participants | `event_id =, status =`           |
| `idx_messages_event`      | Get event chat   | `event_id =` ORDER BY created_at |
| `idx_ratings_received`    | User rating avg  | `to_user_id =`                   |

### Query Patterns

```typescript
// Feed discovery (most common)
SELECT * FROM events
WHERE date_time > NOW()
  AND area = 'City'
  AND category = 'movies'
ORDER BY date_time ASC
LIMIT 20;

// User profile with stats
SELECT u.*, COUNT(r.id) as rating_count, AVG(r.stars) as avg_rating
FROM users u
LEFT JOIN ratings r ON r.to_user_id = u.id
WHERE u.id = $userId
GROUP BY u.id;

// Event with participants
SELECT e.*, COUNT(jr.id) as participant_count
FROM events e
LEFT JOIN join_requests jr ON jr.event_id = e.id AND jr.status = 'approved'
WHERE e.id = $eventId
GROUP BY e.id;
```

---

## 📱 Frontend Integration

### Key Hooks & Stores

```typescript
// Auth Management
useAuthStore                → User session state
→ user, setUser, clearUser

// Event Data
useEvents                   → Event queries & mutations
→ events, loading, error, refetch

useFeed                     → Personalized event feed
→ feed, category, location, pagination

// User Data
useProfile                  → User profile queries
→ profile, ratings, loading

// State Management
authStore (Zustand)        → Auth user state
feedStore (Zustand)        → Feed filters/state
```

### Server State (React Query)

```typescript
// queryClient (lib/queryClient.ts)
// Configured with:
staleTime: 5 * 60 * 1000; // 5 minutes
gcTime: 10 * 60 * 1000; // 10 minutes (cache time)
retry: 2; // Retry failed queries 2x
refetchOnWindowFocus: true; // Refetch when window focused
```

---

## 🔄 Real-Time Features

### Supabase Realtime Subscriptions

```typescript
// Messages real-time
supabase.channel(`event_${eventId}`).on(
  "postgres_changes",
  {
    event: "INSERT",
    schema: "public",
    table: "messages",
    filter: `event_id=eq.${eventId}`,
  },
  callback,
);

// Event updates
supabase.channel(`event_${eventId}`).on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "events",
    filter: `id=eq.${eventId}`,
  },
  callback,
);
```

---

## 📈 Scalability Considerations

### Current Limits

- **Database Size:** 200 MB (free tier)
- **Concurrent Connections:** 50
- **API Requests:** 200 req/min (free), 5000 req/min (pro)
- **Real-time Subscriptions:** Limited

### Scaling Strategy

```
Phase 1 (Current)
├─ Single Supabase project
├─ Local caching (React Query)
└─ Basic indexing

Phase 2 (1000+ users)
├─ Add read replicas
├─ Implement connection pooling
└─ Add Redis caching layer

Phase 3 (10000+ users)
├─ Shard by geography/region
├─ Implement materialized views
├─ Dedicated analytics database
└─ CDN for static content
```

---

## 🐛 Debugging Tips

### Check Database Connection

```typescript
// Test Supabase connection
const { data, error } = await supabase.from("events").select("*").limit(1);
console.log(error ? "❌ Offline" : "✅ Connected");
```

### View Active Subscriptions

```typescript
// In browser console
supabase.realtime.channels;
```

### Check Auth Session

```typescript
const {
  data: { session },
} = await supabase.auth.getSession();
console.log("Auth token:", session?.access_token);
```

### Monitor Network Requests

```
DevTools → Network → Filter by "supabase"
```

---

## 📚 Learning Path

### For New Developers

1. **Start Here:** Read [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. **Understand Schema:** Read [SCHEMA_DOCUMENTATION.md](./SCHEMA_DOCUMENTATION.md)
3. **Learn Queries:** Reference [API_REFERENCE.md](./API_REFERENCE.md)
4. **Implement:** Check [hooks/useEvents.ts](../hooks/useEvents.ts)
5. **Test:** Use mock data from [lib/mockData.ts](../lib/mockData.ts)

### For Data Architects

1. Review [SCHEMA_DOCUMENTATION.md](./SCHEMA_DOCUMENTATION.md)
2. Check [migrations/001_create_core_schema.sql](../migrations/001_create_core_schema.sql)
3. Review security policies
4. Plan scaling strategy

### For DevOps/Infrastructure

1. Read [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Deployment section
2. Configure backups
3. Set up monitoring
4. Plan disaster recovery

---

## 🔗 External Resources

### Official Documentation

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [React Query Docs](https://tanstack.com/query/latest)
- [Expo Docs](https://docs.expo.dev/)

### Related Code Files

- [utils/supabase.ts](../utils/supabase.ts) - Client initialization
- [lib/types.ts](../lib/types.ts) - TypeScript types
- [lib/mockData.ts](../lib/mockData.ts) - Sample data
- [lib/queryClient.ts](../lib/queryClient.ts) - React Query config
- [hooks/useEvents.ts](../hooks/useEvents.ts) - Event queries
- [hooks/useProfile.ts](../hooks/useProfile.ts) - Profile queries

---

## ✅ Checklists

### Pre-Deployment

- [ ] All tables created
- [ ] RLS policies enabled
- [ ] Indexes created
- [ ] Auth configured
- [ ] Environment variables set
- [ ] Mock data cleared
- [ ] Connection tested

### Post-Deployment

- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Rate limits configured
- [ ] CORS configured
- [ ] SSL verified
- [ ] Load testing done
- [ ] Security audit completed

---

## 🎯 Next Steps

1. **Set Up Database:** Follow [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. **Implement Features:** Use [API_REFERENCE.md](./API_REFERENCE.md) patterns
3. **Deploy to Production:** Follow deployment checklist
4. **Monitor & Scale:** Track performance metrics

---

## 📞 Support

For issues or questions:

1. Check the documentation files
2. Review test data in [lib/mockData.ts](../lib/mockData.ts)
3. Check console logs and network requests
4. Verify Supabase dashboard
5. Contact Supabase support

---

**Project:** Toogether - Social Event Discovery App
**Version:** 1.0
**Last Updated:** May 25, 2026
**Status:** ✅ Production Ready

For detailed information, see individual documentation files:

- [SCHEMA_DOCUMENTATION.md](./SCHEMA_DOCUMENTATION.md) - Complete schema reference
- [API_REFERENCE.md](./API_REFERENCE.md) - Query examples
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Deployment guide
