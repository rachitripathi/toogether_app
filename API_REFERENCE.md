# Toogether App - API & Query Reference Guide

**Quick Access Reference for Common Database Operations**

---

## Table of Contents

1. [User Operations](#user-operations)
2. [Event Operations](#event-operations)
3. [Join Request Operations](#join-request-operations)
4. [Message Operations](#message-operations)
5. [Rating Operations](#rating-operations)
6. [Crew Request Operations](#crew-request-operations)
7. [Advanced Queries](#advanced-queries)
8. [Error Handling](#error-handling)

---

## User Operations

### Create/Sign Up User

```typescript
// In: signup form
// Out: new user profile created in database

const signupUser = async (
  email: string,
  password: string,
  profile: Partial<User>,
) => {
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;

  // 2. Create profile in users table
  const { data, error } = await supabase
    .from("users")
    .insert([
      {
        id: authData.user!.id,
        email,
        username: profile.username,
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        city: profile.city,
        bio: profile.bio,
        avatar_colors: profile.avatarColors || ["#8B5CF6", "#6366F1"],
      },
    ])
    .select()
    .single();

  return data;
};
```

### Get User Profile

```typescript
// Get single user by ID
const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  return data;
};

// Get user with rating stats
const getUserProfileWithStats = async (userId: string) => {
  const [user, { data: ratings }] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase.from("ratings").select("stars").eq("to_user_id", userId),
  ]);

  const avgRating =
    ratings && ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(
          1,
        )
      : null;

  return {
    user: user.data,
    avgRating,
    ratingCount: ratings?.length || 0,
  };
};
```

### Update User Profile

```typescript
const updateUserProfile = async (userId: string, updates: Partial<User>) => {
  const { data, error } = await supabase
    .from("users")
    .update({
      name: updates.name,
      bio: updates.bio,
      age: updates.age,
      city: updates.city,
      avatar_uri: updates.avatarUri,
      avatar_colors: updates.avatarColors,
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
```

### Search Users

```typescript
// Search by username or city
const searchUsers = async (query: string) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(20);

  return data;
};

// Get users in same city
const getUsersInCity = async (city: string, excludeId?: string) => {
  let query = supabase.from("users").select("*").eq("city", city).limit(50);

  if (excludeId) query = query.neq("id", excludeId);

  const { data } = await query;
  return data;
};
```

---

## Event Operations

### Create Event

```typescript
const createEvent = async (
  event: Omit<Event, "id" | "approvedUserIds" | "requestUserIds">,
  userId: string,
) => {
  const { data, error } = await supabase
    .from("events")
    .insert([
      {
        title: event.title,
        description: event.description,
        creator_id: userId,
        category: event.category,
        emoji: event.emoji,
        date_time: event.dateTime,
        time_slot: event.timeSlot,
        exact_time: event.exactTime,
        area: event.area,
        exact_location: event.exactLocation,
        location_note: event.locationNote,
        latitude: event.latitude,
        longitude: event.longitude,
        map_url: event.mapUrl,
        max_people: event.maxPeople,
        women_only: event.womenOnly || false,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};
```

### Get Event Feed

```typescript
// Get events by category and location
const getEventsFeed = async (
  category?: string,
  area?: string,
  limit = 20,
  offset = 0,
) => {
  let query = supabase
    .from("events")
    .select("*")
    .gt("date_time", new Date().toISOString())
    .order("date_time", { ascending: true });

  if (category) query = query.eq("category", category);
  if (area) query = query.eq("area", area);

  const { data, error } = await query
    .limit(limit)
    .range(offset, offset + limit - 1);

  return data;
};

// Get events with participant count
const getEventsFeedWithCount = async (category?: string, limit = 20) => {
  const { data, error } = await supabase.rpc(
    "get_events_with_participant_count",
    {
      p_category: category,
      p_limit: limit,
    },
  );

  return data;
};
```

### Get Event Details

```typescript
const getEventDetails = async (eventId: string) => {
  // Get event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError) throw eventError;

  // Get approved participants
  const { data: joinRequests } = await supabase
    .from("join_requests")
    .select("user_id, status")
    .eq("event_id", eventId)
    .eq("status", "approved");

  // Get pending requests
  const { data: pendingRequests } = await supabase
    .from("join_requests")
    .select("user_id, status")
    .eq("event_id", eventId)
    .eq("status", "pending");

  // Get messages
  const { data: messages } = await supabase
    .from("messages")
    .select("*, user:user_id(name, avatar_uri)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    event,
    approvedUsers: joinRequests?.map((jr) => jr.user_id) || [],
    pendingUsers: pendingRequests?.map((jr) => jr.user_id) || [],
    messages: messages || [],
  };
};
```

### Update Event

```typescript
const updateEvent = async (
  eventId: string,
  updates: Partial<Event>,
  userId: string,
) => {
  // Verify ownership
  const { data: event } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", eventId)
    .single();

  if (event?.creator_id !== userId) {
    throw new Error("Unauthorized: Only event creator can update");
  }

  const { data, error } = await supabase
    .from("events")
    .update({
      title: updates.title,
      description: updates.description,
      date_time: updates.dateTime,
      exact_location: updates.exactLocation,
      max_people: updates.maxPeople,
      pinned: updates.pinned,
    })
    .eq("id", eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
```

### Delete Event

```typescript
const deleteEvent = async (eventId: string, userId: string) => {
  // Verify ownership
  const { data: event } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", eventId)
    .single();

  if (event?.creator_id !== userId) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) throw error;
};
```

### Get User's Events

```typescript
// Get events created by user
const getUserCreatedEvents = async (userId: string) => {
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("creator_id", userId)
    .gt("date_time", new Date().toISOString())
    .order("date_time", { ascending: true });

  return data;
};

// Get events user joined
const getUserJoinedEvents = async (userId: string) => {
  const { data } = await supabase
    .from("join_requests")
    .select("event:event_id(*)")
    .eq("user_id", userId)
    .eq("status", "approved");

  return data?.map((jr) => jr.event) || [];
};

// Get upcoming events (created or joined)
const getUserUpcomingEvents = async (userId: string) => {
  const now = new Date().toISOString();

  const [created, joined] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("creator_id", userId)
      .gt("date_time", now)
      .order("date_time", { ascending: true }),
    supabase
      .from("join_requests")
      .select("event:event_id(*)")
      .eq("user_id", userId)
      .eq("status", "approved")
      .gt("event.date_time", now),
  ]);

  const allEvents = [
    ...(created.data || []),
    ...(joined.data?.map((jr) => jr.event) || []),
  ];

  // Remove duplicates and sort
  return [...new Map(allEvents.map((e) => [e.id, e])).values()].sort(
    (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
  );
};
```

---

## Join Request Operations

### Send Join Request

```typescript
const sendJoinRequest = async (userId: string, eventId: string) => {
  const { data, error } = await supabase
    .from("join_requests")
    .insert([
      {
        user_id: userId,
        event_id: eventId,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("You already have a request for this event");
    }
    throw error;
  }

  return data;
};
```

### Approve Join Request

```typescript
const approveJoinRequest = async (
  requestId: string,
  eventId: string,
  userId: string,
) => {
  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("creator_id, max_people")
    .eq("id", eventId)
    .single();

  if (event?.creator_id !== userId) {
    throw new Error("Unauthorized: Only event creator can approve");
  }

  // Check max capacity
  const { data: approvedCount } = await supabase
    .from("join_requests")
    .select("count", { count: "exact" })
    .eq("event_id", eventId)
    .eq("status", "approved");

  if (
    event?.max_people &&
    approvedCount &&
    approvedCount.length >= event.max_people
  ) {
    throw new Error("Event is at maximum capacity");
  }

  const { data, error } = await supabase
    .from("join_requests")
    .update({ status: "approved" })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
```

### Reject Join Request

```typescript
const rejectJoinRequest = async (
  requestId: string,
  eventId: string,
  userId: string,
) => {
  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", eventId)
    .single();

  if (event?.creator_id !== userId) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("join_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (error) throw error;
};
```

### Get Pending Requests for Event

```typescript
const getPendingRequestsForEvent = async (eventId: string) => {
  const { data } = await supabase
    .from("join_requests")
    .select("*, user:user_id(*)")
    .eq("event_id", eventId)
    .eq("status", "pending");

  return data;
};

// Get request status for user-event pair
const getJoinRequestStatus = async (userId: string, eventId: string) => {
  const { data } = await supabase
    .from("join_requests")
    .select("status")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .single();

  return data?.status || null;
};
```

---

## Message Operations

### Send Message

```typescript
const sendMessage = async (eventId: string, userId: string, text: string) => {
  // Verify user is part of event
  const { data: joinRequest } = await supabase
    .from("join_requests")
    .select("status")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();

  const { data: event } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", eventId)
    .single();

  if (!joinRequest && event?.creator_id !== userId) {
    throw new Error("User is not part of this event");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert([
      {
        event_id: eventId,
        user_id: userId,
        text,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};
```

### Get Event Messages

```typescript
const getEventMessages = async (eventId: string, limit = 50) => {
  const { data } = await supabase
    .from("messages")
    .select("*, user:user_id(id, name, avatar_uri)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data?.reverse() || [];
};

// Subscribe to real-time messages
const subscribeToEventMessages = (
  eventId: string,
  callback: (message: Message) => void,
) => {
  return supabase
    .channel(`event_${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        callback(payload.new);
      },
    )
    .subscribe();
};
```

---

## Rating Operations

### Create Rating

```typescript
const createRating = async (
  fromUserId: string,
  toUserId: string,
  eventId: string,
  stars: number,
  comment?: string,
) => {
  if (stars < 1 || stars > 5) {
    throw new Error("Stars must be between 1 and 5");
  }

  const { data, error } = await supabase
    .from("ratings")
    .insert([
      {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        event_id: eventId,
        stars,
        comment: comment || null,
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("You already rated this user for this event");
    }
    throw error;
  }

  return data;
};
```

### Get User Ratings

```typescript
// Get all ratings for a user
const getUserRatings = async (userId: string) => {
  const { data } = await supabase
    .from("ratings")
    .select("*, from_user:from_user_id(name, avatar_uri)")
    .eq("to_user_id", userId)
    .order("created_at", { ascending: false });

  return data;
};

// Get user rating stats
const getUserRatingStats = async (userId: string) => {
  const { data: ratings } = await supabase
    .from("ratings")
    .select("stars")
    .eq("to_user_id", userId);

  if (!ratings || ratings.length === 0) {
    return {
      avgRating: null,
      totalRatings: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;

  ratings.forEach((r) => {
    sum += r.stars;
    distribution[r.stars as keyof typeof distribution]++;
  });

  return {
    avgRating: (sum / ratings.length).toFixed(1),
    totalRatings: ratings.length,
    distribution,
  };
};
```

---

## Crew Request Operations

### Send Crew Request

```typescript
const sendCrewRequest = async (fromUserId: string, toUserId: string) => {
  if (fromUserId === toUserId) {
    throw new Error("Cannot send crew request to yourself");
  }

  const { data, error } = await supabase
    .from("crew_requests")
    .insert([
      {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Crew request already exists");
    }
    throw error;
  }

  return data;
};
```

### Accept/Reject Crew Request

```typescript
const acceptCrewRequest = async (requestId: string, userId: string) => {
  const { data, error } = await supabase
    .from("crew_requests")
    .update({ status: "accepted" })
    .eq("id", requestId)
    .eq("to_user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const rejectCrewRequest = async (requestId: string, userId: string) => {
  const { error } = await supabase
    .from("crew_requests")
    .update({ status: "rejected" })
    .eq("id", requestId)
    .eq("to_user_id", userId);

  if (error) throw error;
};
```

### Get Crew Requests

```typescript
// Get pending crew requests for user
const getPendingCrewRequests = async (userId: string) => {
  const { data } = await supabase
    .from("crew_requests")
    .select("*, from_user:from_user_id(*)")
    .eq("to_user_id", userId)
    .eq("status", "pending");

  return data;
};

// Get accepted crew connections
const getCrewConnections = async (userId: string) => {
  const { data } = await supabase
    .from("crew_requests")
    .select("from_user:from_user_id(*), to_user:to_user_id(*)")
    .or(
      `and(from_user_id.eq.${userId},status.eq.accepted),and(to_user_id.eq.${userId},status.eq.accepted)`,
    );

  return data;
};
```

---

## Advanced Queries

### Feed Discovery (Personalized)

```typescript
const getPersonalizedEventFeed = async (userId: string, limit = 20) => {
  // Get user's city and interests
  const { data: user } = await supabase
    .from("users")
    .select("city, age")
    .eq("id", userId)
    .single();

  if (!user) throw new Error("User not found");

  // Get events in user's city with future dates
  const now = new Date().toISOString();
  const { data: events } = await supabase
    .from("events")
    .select(
      `
      *,
      approved_count:join_requests(count),
      avg_rating:ratings(stars)
    `,
    )
    .eq("area", user.city)
    .gt("date_time", now)
    .order("date_time", { ascending: true })
    .limit(limit);

  return events || [];
};
```

### Get Popular Events

```typescript
const getPopularEvents = async (days = 7, limit = 10) => {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const { data } = await supabase.rpc("get_popular_events", {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    limit,
  });

  return data;
};
```

### Get Event Attendee List with Ratings

```typescript
const getEventAttendeeDetails = async (eventId: string) => {
  const { data } = await supabase
    .from("join_requests")
    .select(
      `
      user:user_id(
        id,
        name,
        avatar_uri,
        avatar_colors
      ),
      avg_rating:ratings(stars)
    `,
    )
    .eq("event_id", eventId)
    .eq("status", "approved");

  return (
    data?.map((item) => ({
      user: item.user,
      avgRating:
        item.avg_rating?.length > 0
          ? item.avg_rating.reduce((sum: number, r: any) => sum + r.stars, 0) /
            item.avg_rating.length
          : null,
    })) || []
  );
};
```

---

## Error Handling

### Common Error Patterns

```typescript
import { PostgrestError } from "@supabase/supabase-js";

const handleSupabaseError = (error: PostgrestError | null) => {
  if (!error) return;

  switch (error.code) {
    case "23505": // Unique violation
      console.error("Duplicate entry:", error.message);
      break;
    case "23503": // Foreign key violation
      console.error("Invalid reference:", error.message);
      break;
    case "42P01": // Table not found
      console.error("Schema error:", error.message);
      break;
    case "PGRST116": // Row-level security
      console.error("Access denied:", error.message);
      break;
    default:
      console.error("Database error:", error.message);
  }
};

// Usage
const result = await supabase.from("events").select("*");
if (result.error) {
  handleSupabaseError(result.error);
}
```

### Batch Operations with Error Recovery

```typescript
const batchApproveRequests = async (requestIds: string[]) => {
  const results = await Promise.allSettled(
    requestIds.map((id) =>
      supabase
        .from("join_requests")
        .update({ status: "approved" })
        .eq("id", id),
    ),
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return {
    successful,
    failed,
    details: results.map((r, i) => ({
      requestId: requestIds[i],
      status: r.status,
      error: r.status === "rejected" ? r.reason : null,
    })),
  };
};
```

---

## Query Performance Tips

### Use `select()` Efficiently

```typescript
// ✅ Good: Only fetch needed columns
.select('id, name, avatar_uri')

// ❌ Avoid: Fetch all columns
.select('*')
```

### Use Filtering Early

```typescript
// ✅ Good: Filter in database
.eq('status', 'approved')
.gt('date_time', now)

// ❌ Avoid: Fetch all and filter in JS
.select('*').then(data => data.filter(...))
```

### Paginate Results

```typescript
// ✅ Good: Use range for pagination
.range(offset, offset + limit - 1)

// ❌ Avoid: Fetch all results
.select('*')
```

### Real-time Subscriptions

```typescript
// ✅ Good: Subscribe only to needed table/columns
supabase.channel('events_feed')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'events',
    filter: 'category=eq.movies'
  }, ...)

// ❌ Avoid: Subscribe to all events
.on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, ...)
```

---

## Related Documentation

- [Full Schema Documentation](./SCHEMA_DOCUMENTATION.md)
- [Supabase Official Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- Frontend Implementation: [hooks/useEvents.ts](hooks/useEvents.ts), [hooks/useProfile.ts](hooks/useProfile.ts)
