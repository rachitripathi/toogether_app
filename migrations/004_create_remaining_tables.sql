-- Toogether App - Create Remaining Tables
-- Version: 1.3
-- Why: `profiles` already exists live and is working. `events`,
-- `join_requests`, `messages`, `ratings`, and `crew_requests` don't exist yet
-- — this migration creates them, matching exactly the columns the app code
-- (providers/AppProvider.tsx) reads and writes. Safe to re-run: uses
-- CREATE TABLE/INDEX IF NOT EXISTS, and drops+recreates policies/triggers
-- rather than relying on invalid `IF NOT EXISTS` variants of those.

-- ============================================================================
-- 1. EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
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

CREATE INDEX IF NOT EXISTS idx_events_creator ON public.events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_datetime ON public.events(date_time);
CREATE INDEX IF NOT EXISTS idx_events_location ON public.events(area);
CREATE INDEX IF NOT EXISTS idx_events_geo ON public.events(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_events_search ON public.events(area, date_time DESC, category);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. JOIN_REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_user ON public.join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_event ON public.join_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON public.join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_pending ON public.join_requests(event_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_join_requests_user_approved ON public.join_requests(user_id, status)
  WHERE status = 'approved';

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_event ON public.messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recent ON public.messages(event_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RATINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_from_user ON public.ratings(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON public.ratings(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_event ON public.ratings(event_id);
CREATE INDEX IF NOT EXISTS idx_ratings_received ON public.ratings(to_user_id);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREW_REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crew_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_requests_from ON public.crew_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_crew_requests_to ON public.crew_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_crew_requests_status ON public.crew_requests(status);

ALTER TABLE public.crew_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. DROP *EVERY* EXISTING POLICY ON THESE TABLES, WHATEVER IT'S CALLED
-- (harmless no-op if the tables were just created and have none yet — this
-- just makes the migration safe to re-run later if policies change)
-- ============================================================================

DO $$
DECLARE
  pol RECORD;
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['events', 'join_requests', 'messages', 'ratings', 'crew_requests']
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, target_table);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

-- EVENTS
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_insert_authenticated" ON public.events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND creator_id = auth.uid());
CREATE POLICY "events_update_creator" ON public.events FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "events_delete_creator" ON public.events FOR DELETE
  USING (auth.uid() = creator_id);

-- JOIN_REQUESTS
CREATE POLICY "join_requests_select_own" ON public.join_requests FOR SELECT
  USING (auth.uid() = user_id OR
         EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()));
CREATE POLICY "join_requests_insert_own" ON public.join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "join_requests_update_creator" ON public.join_requests FOR UPDATE
  USING (EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid()));

-- MESSAGES
CREATE POLICY "messages_select_approved" ON public.messages FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.events e
         LEFT JOIN public.join_requests jr ON e.id = jr.event_id
         WHERE e.id = messages.event_id
         AND (e.creator_id = auth.uid() OR
              (jr.user_id = auth.uid() AND jr.status = 'approved'))));
CREATE POLICY "messages_insert_approved" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND
              EXISTS(SELECT 1 FROM public.events e
              LEFT JOIN public.join_requests jr ON e.id = jr.event_id
              WHERE e.id = messages.event_id
              AND (e.creator_id = auth.uid() OR
                   (jr.user_id = auth.uid() AND jr.status = 'approved'))));

-- RATINGS
CREATE POLICY "ratings_select_all" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_participated" ON public.ratings FOR INSERT
  WITH CHECK (auth.uid() = from_user_id AND
              EXISTS(SELECT 1 FROM public.join_requests
              WHERE event_id = ratings.event_id
              AND user_id = ratings.to_user_id
              AND status = 'approved'));
CREATE POLICY "ratings_update_own" ON public.ratings FOR UPDATE
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);

-- CREW_REQUESTS
CREATE POLICY "crew_requests_select_own" ON public.crew_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "crew_requests_insert_own" ON public.crew_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "crew_requests_update_recipient" ON public.crew_requests FOR UPDATE
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

-- ============================================================================
-- 8. FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_join_requests_updated_at ON public.join_requests;
CREATE TRIGGER update_join_requests_updated_at BEFORE UPDATE ON public.join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_crew_requests_updated_at ON public.crew_requests;
CREATE TRIGGER update_crew_requests_updated_at BEFORE UPDATE ON public.crew_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
