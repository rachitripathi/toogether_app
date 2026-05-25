# Toogether App - Database Setup & Implementation Guide

**A step-by-step guide to set up and deploy the Toogether database schema**

---

## Quick Start (5 minutes)

### Option 1: Automated SQL Execution

1. **In Supabase Dashboard:**
   - Go to SQL Editor
   - Create a new query
   - Copy entire content from `migrations/001_create_core_schema.sql`
   - Click "Run"

2. **Verify Setup:**

   ```bash
   # Check tables exist
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   ```

3. **Enable Auth:**
   - Supabase Dashboard → Authentication → Providers
   - Enable "Email" provider
   - Configure email settings

### Option 2: Use Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Create migration
supabase migration new create_core_schema

# Copy migration file content
# (migrations/001_create_core_schema.sql)

# Push migrations
supabase push
```

---

## Step-by-Step Setup

### Step 1: Create Supabase Project

```bash
# Create new Supabase project
# https://app.supabase.com → New Project

# Save credentials:
EXPO_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
EXPO_PUBLIC_SUPABASE_KEY=eyJhbGc...
```

### Step 2: Create Tables

Run SQL from `migrations/001_create_core_schema.sql` in Supabase SQL Editor.

**Verification:**

```sql
-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Expected output:
-- users
-- events
-- join_requests
-- messages
-- ratings
-- crew_requests
```

### Step 3: Verify Indexes

```sql
-- Check indexes created
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

-- Should include:
-- idx_events_creator
-- idx_events_category
-- idx_join_requests_event
-- idx_messages_event
-- etc.
```

### Step 4: Enable Row-Level Security

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'events', 'join_requests', 'messages', 'ratings', 'crew_requests');

-- All should show 't' (true)
```

### Step 5: Test with Mock Data

```bash
# In your app, the mock data is in lib/mockData.ts
# You can insert it manually or use the app to create test events

# Or insert via SQL:
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'u1',
  'test@example.com',
  '{"name": "Test User"}'::jsonb
);
```

### Step 6: Environment Configuration

Create `.env.local` in project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
EXPO_PUBLIC_SUPABASE_KEY=eyJhbGc...
```

Create `.env.example` for reference:

```env
EXPO_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key_here
```

### Step 7: Test Connection

```typescript
// test-supabase.ts
import { supabase } from "./utils/supabase";

const testConnection = async () => {
  try {
    const { data: tables } = await supabase.from("users").select("*").limit(1);

    console.log("✅ Database connection successful");
    console.log("Tables accessible:", tables);
  } catch (error) {
    console.error("❌ Connection failed:", error);
  }
};

testConnection();
```

---

## Database Schema Reference

### Core Tables

| Table           | Purpose               | Rows          | Status    |
| --------------- | --------------------- | ------------- | --------- |
| `users`         | User profiles & auth  | ~1000s        | ✅ Active |
| `events`        | Event/meetup listings | ~100s-1000s   | ✅ Active |
| `join_requests` | Event participation   | ~1000s-10000s | ✅ Active |
| `messages`      | Event chat            | ~10000s+      | ✅ Active |
| `ratings`       | User reviews          | ~1000s-10000s | ✅ Active |
| `crew_requests` | Friend connections    | ~100s-1000s   | ✅ Active |

### Key Constraints

- **Unique Constraints:**
  - `users.email` (unique)
  - `users.username` (unique)
  - `join_requests(user_id, event_id)` (one per user per event)
  - `crew_requests(from_user_id, to_user_id)` (one per pair)
  - `ratings(from_user_id, to_user_id, event_id)` (one per reviewer/recipient/event)

- **Foreign Keys:**
  - All user_id → `users.id` (CASCADE delete)
  - All event_id → `events.id` (CASCADE delete)

---

## Data Model Relationships

```
┌──────────────────────────────────────────────────────────┐
│ Core Social Event Platform                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  USERS ←→ EVENTS (creator)                              │
│   ↓          ↓                                           │
│   ├→ CREW_REQUESTS (friend system)                      │
│   ├→ RATINGS (review others)                            │
│   └→ JOIN_REQUESTS ←→ EVENTS                            │
│       └→ MESSAGES (chat in events)                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Common Issues & Troubleshooting

### Issue: "Missing Supabase env vars"

**Solution:**

```bash
# Check .env.local exists
cat .env.local

# Should contain:
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_KEY=eyJhbGc...

# Reload app after env changes
```

### Issue: "Row level security policy missing"

**Solution:**

```sql
-- Re-run security policies from migration
-- Or check in SQL Editor:
SELECT * FROM pg_policies;

-- Should list policies for all tables
```

### Issue: "Unique constraint violation"

**Solution:**

```sql
-- Check duplicate data
SELECT email, COUNT(*) as count
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- Delete duplicates manually or clear test data
DELETE FROM users WHERE email LIKE '%@test%';
```

### Issue: "Foreign key constraint violation"

**Solution:**

```sql
-- Check if referenced record exists
SELECT * FROM users WHERE id = 'invalid-id';

-- Ensure parent records exist before inserting child records
-- Use referential integrity checking:
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY';
```

---

## Development Workflow

### Local Development

```bash
# 1. Start app
npm start

# 2. Connect to Supabase project
# (uses env vars from .env.local)

# 3. Use mock data for testing
# lib/mockData.ts provides sample data

# 4. Test queries
# hooks/useEvents.ts
# hooks/useProfile.ts
```

### Database Migrations

```bash
# When schema changes:

# 1. Create migration
supabase migration new add_feature_name

# 2. Write SQL in migrations/timestamp_add_feature_name.sql

# 3. Test locally
supabase push

# 4. Push to production
supabase db push --linked
```

### Testing

```typescript
// Test user operations
const testUserCreation = async () => {
  const newUser = await createUser({
    email: "test@example.com",
    username: "testuser",
    name: "Test User",
    age: 25,
    gender: "other",
    city: "Test City",
  });

  console.log("✅ User created:", newUser);
};

// Test event operations
const testEventCreation = async () => {
  const newEvent = await createEvent(
    {
      title: "Test Event",
      description: "A test event",
      category: "chill",
      emoji: "☕",
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      // ... other fields
    },
    userId,
  );

  console.log("✅ Event created:", newEvent);
};
```

---

## Production Checklist

- [ ] All tables created and verified
- [ ] Row-Level Security policies enabled
- [ ] Indexes created for performance
- [ ] Auth email provider configured
- [ ] Environment variables set in deployment
- [ ] Database backups configured
- [ ] Rate limiting configured
- [ ] CORS settings configured
- [ ] Test data cleared
- [ ] SSL certificate verified

### Production Environment Variables

```env
# .env.production
EXPO_PUBLIC_SUPABASE_URL=https://[production-project].supabase.co
EXPO_PUBLIC_SUPABASE_KEY=eyJhbGc... (production key)
```

### Backup Strategy

```bash
# Set up automated backups in Supabase
# Dashboard → Database → Backups

# Manual backup:
pg_dump \
  -h [project].supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f backup.dump
```

---

## Performance Optimization

### Indexes Strategy

The following indexes are automatically created:

```sql
-- User queries
idx_users_username         -- Search by username
idx_users_city            -- Find users in location
idx_users_verified        -- Filter verified users

-- Event discovery
idx_events_category       -- Filter by type
idx_events_datetime       -- Sort by date
idx_events_geo            -- Location-based search
idx_events_search         -- Combined search index

-- Participation tracking
idx_join_requests_event   -- Get event participants
idx_join_requests_status  -- Filter by status

-- Messaging
idx_messages_event        -- Get event messages
idx_messages_created_at   -- Recent messages first
```

### Query Optimization

```typescript
// ❌ Slow query
const events = await supabase.from("events").select("*");

// ✅ Fast query
const events = await supabase
  .from("events")
  .select("id, title, category, date_time, creator_id")
  .gt("date_time", now)
  .order("date_time")
  .limit(20);
```

---

## API Integration

### Available Endpoints

All queries go through Supabase API:

```
Base URL: https://[project].supabase.co

POST /rest/v1/[table]        # Create
GET /rest/v1/[table]         # Read
PATCH /rest/v1/[table]       # Update
DELETE /rest/v1/[table]      # Delete
```

### Rate Limits

- Free tier: 200 requests/minute
- Pro tier: 5000 requests/minute

### Authentication Headers

```typescript
// Automatically handled by supabase-js SDK
// Or manually:

const headers = {
  Authorization: `Bearer ${accessToken}`,
  apikey: supabaseKey,
  "Content-Type": "application/json",
};
```

---

## Monitoring & Debugging

### View Database Logs

```bash
# Supabase Dashboard → Logs → PostgreSQL

# Or query directly:
SELECT * FROM postgres_logs LIMIT 100;
```

### Monitor Active Queries

```sql
SELECT * FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;
```

### Check Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Next Steps

1. **Run Migration:** Execute SQL from `migrations/001_create_core_schema.sql`
2. **Configure Auth:** Set up email authentication in Supabase
3. **Set Environment Variables:** Configure `.env.local`
4. **Test Connection:** Run connection test
5. **Implement Features:** Use `API_REFERENCE.md` for queries
6. **Deploy:** Push to production

---

## Documentation Files

| File                                                 | Purpose                        |
| ---------------------------------------------------- | ------------------------------ |
| [SCHEMA_DOCUMENTATION.md](./SCHEMA_DOCUMENTATION.md) | Complete schema reference      |
| [API_REFERENCE.md](./API_REFERENCE.md)               | Query examples and patterns    |
| [SETUP_GUIDE.md](./SETUP_GUIDE.md)                   | This file - setup instructions |
| `migrations/001_create_core_schema.sql`              | SQL migration file             |

---

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/current/
- **React Query:** https://tanstack.com/query/latest
- **React Native:** https://reactnative.dev

---

**Last Updated:** May 25, 2026
**Version:** 1.0
**Status:** ✅ Production Ready
