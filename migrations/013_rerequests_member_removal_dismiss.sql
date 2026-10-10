-- Toogether App - Re-requests, member removal, dismissible notifications
-- Why (three app features land together, each needs a small schema change):
--   1. A declined requester gets 2 more tries at the same plan (3 requests in total).
--      `join_requests` keeps UNIQUE(user_id, event_id), so a re-request reuses the same row
--      (rejected -> pending) and `attempts` counts how many times it has been sent. The
--      requester can't UPDATE their own row under RLS (only the host can), so the flip goes
--      through `rerequest_to_join()` (SECURITY DEFINER), which enforces the limit.
--   2. A host can remove an approved member. That's a new terminal status, 'removed': it
--      drops them out of the chat/details RLS (both only accept 'approved') and, unlike
--      'rejected', can never be re-requested. The host flips it through the existing
--      `join_requests_update_creator` policy; the status trigger notifies the member.
--   3. Activity notifications can be swiped away. `dismissed_at` is a soft delete the owner
--      sets through the existing `notifications_update_own` policy, so the app's 10-second
--      Undo is just clearing it again, and nothing is lost if the app dies mid-undo.
-- Safe to re-run: IF NOT EXISTS columns, constraints dropped by lookup before re-adding,
-- CREATE OR REPLACE functions.

-- ============================================================================
-- 1. join_requests: attempts + 'removed' status
-- ============================================================================

ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 1;

-- The status CHECK was declared inline in 004, so look it up by definition rather than
-- trusting the auto-generated name (the live table predates some migrations).
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.join_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.join_requests DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;

ALTER TABLE public.join_requests
  ADD CONSTRAINT join_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'removed'));

-- Requester-side re-request after a decline. Returns the new attempt count.
CREATE OR REPLACE FUNCTION public.rerequest_to_join(p_event_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND deleted_at IS NULL AND date_time > now()
  ) THEN
    RAISE EXCEPTION 'This plan has already happened.';
  END IF;

  SELECT id, status, attempts INTO v_request
  FROM public.join_requests
  WHERE event_id = p_event_id AND user_id = auth.uid()
  FOR UPDATE;

  IF v_request.id IS NULL OR v_request.status <> 'rejected' THEN
    RAISE EXCEPTION 'There is no declined request to send again.';
  END IF;

  IF v_request.attempts >= 3 THEN
    RAISE EXCEPTION 'You have used all your requests for this plan.';
  END IF;

  UPDATE public.join_requests
  SET status = 'pending', attempts = attempts + 1
  WHERE id = v_request.id;

  RETURN v_request.attempts + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.rerequest_to_join(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rerequest_to_join(UUID) TO authenticated;

-- ============================================================================
-- 2. notifications: 'join_request_removed' type + dismissed_at
-- ============================================================================

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

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
    'verification_approved',
    'verification_rejected',
    'new_message'
  ));

-- ============================================================================
-- 3. Status-change trigger: also covers a re-request (-> pending, notify the host)
--    and a removal (-> removed, notify the member). Replaces 009's version.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_join_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_actor_name TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT id, title, creator_id INTO v_event FROM public.events WHERE id = NEW.event_id;
  IF v_event.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'join_request_approved',
      'You''re approved for ' || v_event.title,
      'Open the event to view details and chat.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id)
    );
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'join_request_rejected',
      'Join request not approved for ' || v_event.title,
      CASE WHEN NEW.attempts < 3
        THEN 'You can send another request from the plan page.'
        ELSE 'Try another plan or request a different event.'
      END,
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id)
    );
  ELSIF NEW.status = 'removed' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'join_request_removed',
      'You were removed from ' || v_event.title,
      'The host removed you from this plan.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id)
    );
  ELSIF NEW.status = 'pending' THEN
    SELECT COALESCE(name, 'Someone') INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
    PERFORM public.create_notification(
      v_event.creator_id,
      'join_request_received',
      v_actor_name || ' asked again to join ' || v_event.title,
      'Open the plan to review this request.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id, 'actorId', NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
