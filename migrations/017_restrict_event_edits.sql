-- Toogether App - After posting, a plan's time (same day) and description are all a host can edit
-- Why: `events_update_creator` lets the host rewrite any column, and the app's Edit plan sheet
-- exposed title, locality, location note, group size, time-of-day and a free-text "exact
-- time" that wasn't even connected to the real start (`date_time`). A plan could be turned into
-- a different plan after people had joined it. From now on the host can only:
--   - move the start time, on the same day (India time), at least 15 minutes ahead
--     (validate_event(), 015/016), and only before it starts. Keeping the date fixed means a
--     plan can't be pushed back day after day indefinitely;
--   - edit the description, before it starts;
--   - cancel it (deleted_at), any time.
-- exact_time / time_slot are the display labels for date_time and move with it. Approved members
-- are notified when the time changes. Admins (is_admin()) are exempt from all of this.
-- Safe to re-run.

-- ============================================================================
-- 1. Notification type
-- ============================================================================

DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'join_request_received',
    'join_request_approved',
    'join_request_rejected',
    'join_request_removed',
    'event_invite_received',
    'event_invite_accepted',
    'event_invite_declined',
    'event_time_changed',
    'crew_request_received',
    'crew_request_accepted',
    'verification_approved',
    'verification_rejected',
    'new_message'
  ));

-- ============================================================================
-- 2. Edit restrictions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.restrict_event_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF (NEW.creator_id, NEW.title, NEW.category, NEW.emoji, NEW.area, NEW.exact_location,
      NEW.location_note, NEW.latitude, NEW.longitude, NEW.map_url, NEW.max_people,
      NEW.women_only, NEW.pinned, NEW.created_at)
     IS DISTINCT FROM
     (OLD.creator_id, OLD.title, OLD.category, OLD.emoji, OLD.area, OLD.exact_location,
      OLD.location_note, OLD.latitude, OLD.longitude, OLD.map_url, OLD.max_people,
      OLD.women_only, OLD.pinned, OLD.created_at)
  THEN
    RAISE EXCEPTION 'Only the time and description can be changed after a plan is posted.';
  END IF;

  IF (NEW.date_time, NEW.exact_time, NEW.time_slot, NEW.description)
     IS DISTINCT FROM (OLD.date_time, OLD.exact_time, OLD.time_slot, OLD.description)
  THEN
    IF OLD.date_time <= now() THEN
      RAISE EXCEPTION 'This plan has already started, so it can''t be edited.';
    END IF;
    IF (NEW.date_time AT TIME ZONE 'Asia/Kolkata')::date <> (OLD.date_time AT TIME ZONE 'Asia/Kolkata')::date THEN
      RAISE EXCEPTION 'You can change the time, but not the day. Cancel and create a new plan for another day.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_event_edits_before_update ON public.events;
CREATE TRIGGER restrict_event_edits_before_update
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.restrict_event_edits();

-- ============================================================================
-- 3. Tell approved members when the time moves
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_event_time_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
BEGIN
  IF NEW.date_time IS NOT DISTINCT FROM OLD.date_time OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR v_member IN
    SELECT user_id FROM public.join_requests WHERE event_id = NEW.id AND status = 'approved'
  LOOP
    PERFORM public.create_notification(
      v_member,
      'event_time_changed',
      'New time for ' || NEW.title,
      'It now starts at ' || NEW.exact_time || '.',
      jsonb_build_object('route', '/event/' || NEW.id, 'eventId', NEW.id, 'actorId', NEW.creator_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_event_time_change ON public.events;
CREATE TRIGGER notify_event_time_change
  AFTER UPDATE OF date_time ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_event_time_change();
