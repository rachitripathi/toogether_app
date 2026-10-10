-- Toogether App - Real crew connections + consent-based event invites
-- Why:
--   1. Crew was local-only in the app (an in-memory list seeded with fake users), so two real
--      users could never connect. The app now reads/writes `crew_requests` for real. Its 004
--      write policies weren't safe to rely on once crew gates invites: INSERT let a client
--      create a row already 'accepted' (a forged connection with anyone), and the recipient's
--      UPDATE could rewrite from_user_id. So client writes are closed off and every change goes
--      through SECURITY DEFINER functions below that enforce the flow.
--   2. "Invite to my event" inserted a join_requests row for someone else, which the
--      `join_requests_insert_own` policy refuses (auth.uid() must be the row's user). It was also
--      auto-approved, dropping people into plans without asking. Now the host calls
--      invite_to_event() (host + accepted crew only), which creates an 'invited' row; the invitee
--      accepts (-> 'approved') or declines (row deleted, so they can still request later)
--      through respond_to_invite().
-- Safe to re-run: constraints dropped by lookup before re-adding, CREATE OR REPLACE functions,
-- DROP ... IF EXISTS for policies/triggers, publication add wrapped.

-- ============================================================================
-- 1. Notification types
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
    'crew_request_received',
    'crew_request_accepted',
    'verification_approved',
    'verification_rejected',
    'new_message'
  ));

-- ============================================================================
-- 2. Crew: no direct client writes, RPCs only, realtime
-- ============================================================================

DROP POLICY IF EXISTS "crew_requests_insert_own" ON public.crew_requests;
DROP POLICY IF EXISTS "crew_requests_update_recipient" ON public.crew_requests;
-- crew_requests_select_own (either side can read) stays as created in 004.

-- Send a crew request to p_to_user_id. Returns the resulting relationship:
--   'connected' — already connected, or they had already asked you (their request is accepted)
--   'pending'   — your request is waiting for them
CREATE OR REPLACE FUNCTION public.send_crew_request(p_to_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_existing RECORD;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_to_user_id IS NULL OR p_to_user_id = v_me THEN
    RAISE EXCEPTION 'You can''t add yourself to your crew.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_to_user_id) THEN
    RAISE EXCEPTION 'That profile no longer exists.';
  END IF;

  -- A declined request, in either direction, doesn't block a fresh one.
  DELETE FROM public.crew_requests
  WHERE status = 'rejected'
    AND ((from_user_id = v_me AND to_user_id = p_to_user_id)
      OR (from_user_id = p_to_user_id AND to_user_id = v_me));

  SELECT * INTO v_existing FROM public.crew_requests
  WHERE (from_user_id = v_me AND to_user_id = p_to_user_id)
     OR (from_user_id = p_to_user_id AND to_user_id = v_me)
  LIMIT 1
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status = 'accepted' THEN
      RETURN 'connected';
    END IF;
    IF v_existing.from_user_id = p_to_user_id THEN
      -- They asked first: adding them back is accepting.
      UPDATE public.crew_requests SET status = 'accepted' WHERE id = v_existing.id;
      RETURN 'connected';
    END IF;
    RETURN 'pending';
  END IF;

  INSERT INTO public.crew_requests (from_user_id, to_user_id, status)
  VALUES (v_me, p_to_user_id, 'pending');
  RETURN 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.send_crew_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_crew_request(UUID) TO authenticated;

-- Recipient accepts or declines a pending crew request addressed to them.
CREATE OR REPLACE FUNCTION public.respond_to_crew_request(p_request_id UUID, p_accept BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.crew_requests
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END
  WHERE id = p_request_id AND to_user_id = auth.uid() AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This crew request is no longer pending.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_crew_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_crew_request(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_crew_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(name, 'Someone') INTO v_name FROM public.profiles WHERE id = NEW.from_user_id;
    PERFORM public.create_notification(
      NEW.to_user_id,
      'crew_request_received',
      v_name || ' wants to add you to their crew',
      'Open their profile to accept or decline.',
      jsonb_build_object('route', '/user/' || NEW.from_user_id, 'actorId', NEW.from_user_id)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    SELECT COALESCE(name, 'Someone') INTO v_name FROM public.profiles WHERE id = NEW.to_user_id;
    PERFORM public.create_notification(
      NEW.from_user_id,
      'crew_request_accepted',
      v_name || ' is now in your crew',
      'You can invite them to your plans.',
      jsonb_build_object('route', '/user/' || NEW.to_user_id, 'actorId', NEW.to_user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_crew_request_change ON public.crew_requests;
CREATE TRIGGER notify_crew_request_change
  AFTER INSERT OR UPDATE OF status ON public.crew_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_crew_request_change();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. Event invites: 'invited' status + RPCs
-- ============================================================================

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
  CHECK (status IN ('pending', 'approved', 'rejected', 'removed', 'invited'));

-- Host invites an accepted crew member. Creates (or, over an earlier declined/removed request,
-- turns into) an 'invited' row; nothing is granted until the invitee accepts.
CREATE OR REPLACE FUNCTION public.invite_to_event(p_event_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_event RECORD;
  v_existing RECORD;
  v_approved INT;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND deleted_at IS NULL;
  IF v_event.id IS NULL OR v_event.creator_id <> v_me THEN
    RAISE EXCEPTION 'Only the host can invite people to this plan.';
  END IF;
  IF v_event.date_time <= now() THEN
    RAISE EXCEPTION 'This plan has already started.';
  END IF;
  IF p_user_id = v_me THEN
    RAISE EXCEPTION 'You''re already hosting this plan.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.crew_requests
    WHERE status = 'accepted'
      AND ((from_user_id = v_me AND to_user_id = p_user_id)
        OR (from_user_id = p_user_id AND to_user_id = v_me))
  ) THEN
    RAISE EXCEPTION 'You can only invite people in your crew.';
  END IF;

  IF v_event.women_only AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND gender = 'woman'
  ) THEN
    RAISE EXCEPTION 'This is a women-only plan.';
  END IF;

  IF v_event.max_people IS NOT NULL THEN
    SELECT count(*) INTO v_approved FROM public.join_requests
    WHERE event_id = p_event_id AND status = 'approved';
    IF v_approved + 1 >= v_event.max_people THEN
      RAISE EXCEPTION 'This plan is already full.';
    END IF;
  END IF;

  SELECT * INTO v_existing FROM public.join_requests
  WHERE event_id = p_event_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.join_requests (user_id, event_id, status)
    VALUES (p_user_id, p_event_id, 'invited');
  ELSIF v_existing.status = 'approved' THEN
    RAISE EXCEPTION 'They''re already going.';
  ELSIF v_existing.status = 'invited' THEN
    RAISE EXCEPTION 'They''re already invited.';
  ELSIF v_existing.status = 'pending' THEN
    RAISE EXCEPTION 'They''ve already asked to join. Accept their request instead.';
  ELSE
    UPDATE public.join_requests SET status = 'invited' WHERE id = v_existing.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_to_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_to_event(UUID, UUID) TO authenticated;

-- Invitee answers. Accept -> 'approved' (full member). Decline -> the row is deleted, so they
-- can still request to join later and the host can invite again.
CREATE OR REPLACE FUNCTION public.respond_to_invite(p_event_id UUID, p_accept BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_event RECORD;
  v_request RECORD;
  v_approved INT;
  v_name TEXT;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_request FROM public.join_requests
  WHERE event_id = p_event_id AND user_id = v_me AND status = 'invited'
  FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'This invite is no longer open.';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND deleted_at IS NULL;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'This plan was cancelled.';
  END IF;

  IF NOT p_accept THEN
    DELETE FROM public.join_requests WHERE id = v_request.id;
    SELECT COALESCE(name, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
    PERFORM public.create_notification(
      v_event.creator_id,
      'event_invite_declined',
      v_name || ' can''t make ' || v_event.title,
      'They declined your invite.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id, 'actorId', v_me)
    );
    RETURN;
  END IF;

  IF v_event.date_time <= now() THEN
    RAISE EXCEPTION 'This plan has already started.';
  END IF;
  IF v_event.max_people IS NOT NULL THEN
    SELECT count(*) INTO v_approved FROM public.join_requests
    WHERE event_id = p_event_id AND status = 'approved';
    IF v_approved + 1 >= v_event.max_people THEN
      RAISE EXCEPTION 'Sorry, this plan filled up.';
    END IF;
  END IF;

  -- The status trigger below notifies the host.
  UPDATE public.join_requests SET status = 'approved' WHERE id = v_request.id;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_invite(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_invite(UUID, BOOLEAN) TO authenticated;

-- ============================================================================
-- 4. join_requests notification triggers, extended for invites. Replace 009/013 versions.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_join_request_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_actor_name TEXT;
BEGIN
  SELECT id, title, creator_id INTO v_event FROM public.events WHERE id = NEW.event_id;
  IF v_event.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending' THEN
    SELECT COALESCE(name, 'Someone') INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
    PERFORM public.create_notification(
      v_event.creator_id,
      'join_request_received',
      v_actor_name || ' wants to join ' || v_event.title,
      'Open the plan to review this request.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id, 'actorId', NEW.user_id)
    );
  ELSIF NEW.status = 'invited' THEN
    SELECT COALESCE(name, 'Someone') INTO v_actor_name FROM public.profiles WHERE id = v_event.creator_id;
    PERFORM public.create_notification(
      NEW.user_id,
      'event_invite_received',
      v_actor_name || ' invited you to ' || v_event.title,
      'Open the plan to accept or decline.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id, 'actorId', v_event.creator_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

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

  IF NEW.status = 'approved' AND OLD.status = 'invited' THEN
    -- Invitee accepted: tell the host, not the invitee.
    SELECT COALESCE(name, 'Someone') INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
    PERFORM public.create_notification(
      v_event.creator_id,
      'event_invite_accepted',
      v_actor_name || ' is joining ' || v_event.title,
      'They accepted your invite.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id, 'actorId', NEW.user_id)
    );
  ELSIF NEW.status = 'approved' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'join_request_approved',
      'You''re approved for ' || v_event.title,
      'Open the event to view details and chat.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id)
    );
  ELSIF NEW.status = 'invited' THEN
    SELECT COALESCE(name, 'Someone') INTO v_actor_name FROM public.profiles WHERE id = v_event.creator_id;
    PERFORM public.create_notification(
      NEW.user_id,
      'event_invite_received',
      v_actor_name || ' invited you to ' || v_event.title,
      'Open the plan to accept or decline.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id, 'actorId', v_event.creator_id)
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
