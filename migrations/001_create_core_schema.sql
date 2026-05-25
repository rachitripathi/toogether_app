-- Toogether App - Core Schema Migration
-- Version: 1.0
-- Description: Create all core tables for the Toogether event discovery app

-- ============================================================================
-- 1. USERS TABLE - Authentication & User Profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  age INT CHECK (age >= 13 AND age <= 120),
  gender VARCHAR(50) NOT NULL DEFAULT 'other'
    CHECK (gender IN ('man', 'woman', 'other')),
  city VARCHAR(255) NOT NULL,
  avatar_uri TEXT,
  avatar_colors JSONB NOT NULL DEFAULT '["#8B5CF6", "#6366F1"]',
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. EVENTS TABLE - Core Event/Meetup Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_events_creator ON events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_datetime ON events(date_time);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(area);
CREATE INDEX IF NOT EXISTS idx_events_geo ON events(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_events_search ON events(area, date_time DESC, category)
  WHERE date_time > now();

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. JOIN_REQUESTS TABLE - Event Participation Workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_event ON join_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_pending ON join_requests(event_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_join_requests_user_approved ON join_requests(user_id, status)
  WHERE status = 'approved';

ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. MESSAGES TABLE - Event Chat/Messaging
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_event ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recent ON messages(event_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RATINGS TABLE - Post-Event Reviews & User Ratings
-- ============================================================================

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_from_user ON ratings(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON ratings(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_event ON ratings(event_id);
CREATE INDEX IF NOT EXISTS idx_ratings_received ON ratings(to_user_id);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. CREW_REQUESTS TABLE - Friend/Crew Connections
-- ============================================================================

CREATE TABLE IF NOT EXISTS crew_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_requests_from ON crew_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_crew_requests_to ON crew_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_crew_requests_status ON crew_requests(status);

ALTER TABLE crew_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- USERS Policies
CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- EVENTS Policies
CREATE POLICY "events_select_all" ON events FOR SELECT USING (true);
CREATE POLICY "events_insert_authenticated" ON events FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated' AND creator_id = auth.uid());
CREATE POLICY "events_update_creator" ON events FOR UPDATE 
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "events_delete_creator" ON events FOR DELETE 
  USING (auth.uid() = creator_id);

-- JOIN_REQUESTS Policies
CREATE POLICY "join_requests_select_own" ON join_requests FOR SELECT 
  USING (auth.uid() = user_id OR 
         EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()));
CREATE POLICY "join_requests_insert_own" ON join_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "join_requests_update_creator" ON join_requests FOR UPDATE 
  USING (EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()));

-- MESSAGES Policies
CREATE POLICY "messages_select_approved" ON messages FOR SELECT 
  USING (EXISTS(SELECT 1 FROM events e 
         LEFT JOIN join_requests jr ON e.id = jr.event_id 
         WHERE e.id = messages.event_id 
         AND (e.creator_id = auth.uid() OR 
              (jr.user_id = auth.uid() AND jr.status = 'approved'))));
CREATE POLICY "messages_insert_approved" ON messages FOR INSERT 
  WITH CHECK (auth.uid() = user_id AND
              EXISTS(SELECT 1 FROM events e 
              LEFT JOIN join_requests jr ON e.id = jr.event_id 
              WHERE e.id = messages.event_id 
              AND (e.creator_id = auth.uid() OR 
                   (jr.user_id = auth.uid() AND jr.status = 'approved'))));

-- RATINGS Policies
CREATE POLICY "ratings_select_all" ON ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_participated" ON ratings FOR INSERT 
  WITH CHECK (auth.uid() = from_user_id AND
              EXISTS(SELECT 1 FROM join_requests 
              WHERE event_id = ratings.event_id 
              AND user_id = ratings.to_user_id 
              AND status = 'approved'));
CREATE POLICY "ratings_update_own" ON ratings FOR UPDATE 
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);

-- CREW_REQUESTS Policies
CREATE POLICY "crew_requests_select_own" ON crew_requests FOR SELECT 
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "crew_requests_insert_own" ON crew_requests FOR INSERT 
  WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "crew_requests_update_recipient" ON crew_requests FOR UPDATE 
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on table changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables that have it
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_join_requests_updated_at BEFORE UPDATE ON join_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crew_requests_updated_at BEFORE UPDATE ON crew_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CLEANUP / ROLLBACK (for development/testing)
-- ============================================================================
/*
-- To rollback this migration, uncomment and run:

DROP TRIGGER IF EXISTS update_crew_requests_updated_at ON crew_requests;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP TRIGGER IF EXISTS update_join_requests_updated_at ON join_requests;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS crew_requests;
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS join_requests;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;
*/
