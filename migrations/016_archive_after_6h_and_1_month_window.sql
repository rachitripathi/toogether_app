-- Toogether App - Plans archive 6 hours after they start; plans can be at most 1 month ahead
-- Why:
--   1. A plan used to stay readable to everyone for 48h after its start time (011), with its
--      chat open the whole time. Now, 6 hours after `date_time`, a plan is archived:
--        - everyone else loses it entirely;
--        - its host and approved members can still read the row, so it stays in their
--          Profile -> Past plans as a list entry (the app shows no details for it);
--        - the chat closes for everyone, reads and new messages alike;
--        - admins keep full access through the existing is_admin() clauses, so the admin
--          panel still sees everything.
--      Nothing is deleted; archiving is purely a visibility rule.
--   2. Plans can be scheduled at most 1 month ahead (was 2 years; 015's validate_event()).
-- Safe to re-run: CREATE OR REPLACE functions, DROP POLICY IF EXISTS before each CREATE.

-- ============================================================================
-- 1. Membership helper
-- ============================================================================

-- events' SELECT policy needs "is the caller an approved member", but join_requests' own SELECT
-- policy already looks at events, and Postgres refuses policies that reference each other
-- ("infinite recursion detected in policy"). A SECURITY DEFINER function reads join_requests
-- without going through its RLS, which breaks the cycle. It only ever answers for auth.uid().
CREATE OR REPLACE FUNCTION public.is_event_member(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.join_requests
    WHERE event_id = p_event_id AND user_id = auth.uid() AND status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_event_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_member(UUID) TO authenticated;

-- ============================================================================
-- 2. events: public until 6h after start, then host + members only
-- ============================================================================

DROP POLICY IF EXISTS "events_select_all" ON public.events;
CREATE POLICY "events_select_all" ON public.events FOR SELECT
  USING (
    public.is_admin()
    OR (
      deleted_at IS NULL
      AND (
        date_time > now() - interval '6 hours'
        OR creator_id = auth.uid()
        OR public.is_event_member(id)
      )
    )
  );

-- ============================================================================
-- 3. messages: chat closes 6h after start
-- ============================================================================

DROP POLICY IF EXISTS "messages_select_approved" ON public.messages;
CREATE POLICY "messages_select_approved" ON public.messages FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = messages.event_id
        AND e.deleted_at IS NULL
        AND e.date_time > now() - interval '6 hours'
        AND (e.creator_id = auth.uid() OR public.is_event_member(e.id))
    )
  );

DROP POLICY IF EXISTS "messages_insert_approved" ON public.messages;
CREATE POLICY "messages_insert_approved" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = messages.event_id
        AND e.deleted_at IS NULL
        AND e.date_time > now() - interval '6 hours'
        AND (e.creator_id = auth.uid() OR public.is_event_member(e.id))
    )
  );

-- ============================================================================
-- 4. Scheduling window: at most 1 month ahead (replaces 015's version)
-- ============================================================================

-- The upper bound has a day of slack: the app caps the *date* at one month from today in the
-- user's local time and then lets them pick any time that day, which can land a few hours past
-- now() + 1 month in UTC.
CREATE OR REPLACE FUNCTION public.validate_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(btrim(coalesce(NEW.title, ''))) < 3 THEN
    RAISE EXCEPTION 'Give the plan a title of at least 3 characters.';
  END IF;
  IF length(NEW.title) > 60 THEN
    RAISE EXCEPTION 'Plan titles can be at most 60 characters.';
  END IF;
  IF length(btrim(coalesce(NEW.area, ''))) = 0 THEN
    RAISE EXCEPTION 'Add the locality shown publicly.';
  END IF;
  IF length(btrim(coalesce(NEW.exact_location, ''))) = 0 THEN
    RAISE EXCEPTION 'Add the exact address.';
  END IF;
  IF length(coalesce(NEW.description, '')) > 200 THEN
    RAISE EXCEPTION 'Descriptions can be at most 200 characters.';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.max_people IS NULL THEN
    RAISE EXCEPTION 'Set how many people can join (2 to 10, including you).';
  END IF;
  IF NEW.max_people IS NOT NULL AND (NEW.max_people < 2 OR NEW.max_people > 10) THEN
    RAISE EXCEPTION 'Group size must be between 2 and 10, including you.';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.date_time IS DISTINCT FROM OLD.date_time THEN
    IF NEW.date_time <= now() + interval '15 minutes' THEN
      RAISE EXCEPTION 'Plans need to start at least 15 minutes from now.';
    END IF;
    IF NEW.date_time > now() + interval '1 month' + interval '1 day' THEN
      RAISE EXCEPTION 'Plans can be scheduled at most 1 month ahead.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
