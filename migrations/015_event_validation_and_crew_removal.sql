-- Toogether App - Server-side plan validation + removing someone from your crew
-- Why:
--   1. `events_insert_authenticated` (004) only checks who the creator is, so the create-plan
--      form's checks were the only thing stopping a plan with no group size, a blank title or
--      address, or a start time already in the past (the date picker blocked past *days*, but
--      not an earlier time today). The form now checks all of these; this trigger enforces the
--      same rules for any client.
--   2. Crew connections can be ended. Crew writes are RPC-only since 014, so this adds one.
-- Safe to re-run: CREATE OR REPLACE functions, DROP TRIGGER IF EXISTS.

-- ============================================================================
-- 1. Plan validation
-- ============================================================================

-- Mirrors app/create-event.tsx. Existing rows aren't revalidated: the date window is only
-- checked when date_time is set or changed, and an UPDATE that leaves max_people NULL on an
-- older plan is allowed (plans from before this migration may have no size).
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
    IF NEW.date_time > now() + interval '2 years' THEN
      RAISE EXCEPTION 'Plans can be scheduled at most 2 years ahead.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_event_before_write ON public.events;
CREATE TRIGGER validate_event_before_write
  BEFORE INSERT OR UPDATE OF title, area, exact_location, description, max_people, date_time ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.validate_event();

-- ============================================================================
-- 2. Remove from crew
-- ============================================================================

-- Ends the crew relationship with p_user_id from either side: an accepted connection, or a
-- request either of you sent that's still pending (so it also works as "cancel request").
-- Open invites between the two of you go too, since invites need crew; anyone who already
-- accepted stays in the plan. Silent: the other person isn't notified.
CREATE OR REPLACE FUNCTION public.remove_from_crew(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.crew_requests
  WHERE (from_user_id = v_me AND to_user_id = p_user_id)
     OR (from_user_id = p_user_id AND to_user_id = v_me);

  DELETE FROM public.join_requests jr
  USING public.events e
  WHERE jr.event_id = e.id
    AND jr.status = 'invited'
    AND ((e.creator_id = v_me AND jr.user_id = p_user_id)
      OR (e.creator_id = p_user_id AND jr.user_id = v_me));
END;
$$;

REVOKE ALL ON FUNCTION public.remove_from_crew(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_from_crew(UUID) TO authenticated;
