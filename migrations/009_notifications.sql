-- Toogether App - Notifications
-- Version: 1.0
-- Why: there is no notification system today. FUNCTIONALITY.md §7 documents the concrete
-- gap this closes: a verification decision (review_verification()) never reaches the user
-- except on their next refreshProfile() call. The Activity tab is also not a real inbox —
-- it's recomputed client-side from `requests`/`crewRequests` on every render, so it has no
-- persistence and misses anything that happened while the app was closed.
--
-- This migration adds:
--   1. `notifications` — one row per event a user should be told about. Written only by
--      `create_notification()` (SECURITY DEFINER), never directly by a client — same
--      pattern as `verification_reviews` (007): no INSERT/DELETE policy for any client role.
--   2. `push_tokens` — Expo push tokens per device, schema-only in this migration (no sender
--      yet — that's a later phase). Owner-managed (a device registers/removes its own token).
--   3. Triggers on `join_requests` (insert + status change) and `messages` (insert) that call
--      `create_notification()` to populate the feed for the join-request lifecycle and new
--      chat messages.
--   4. `review_verification()` (007) extended to also call `create_notification()` — the
--      literal fix for the §7 gap.
--   5. `notifications` added to the `supabase_realtime` publication, so the in-app inbox can
--      subscribe live the same way `messages` already does (005).
-- Safe to re-run: CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE for functions, and the
-- publication add is wrapped to ignore "already a member".

-- ============================================================================
-- 1. NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'join_request_received',
    'join_request_approved',
    'join_request_rejected',
    'verification_approved',
    'verification_rejected',
    'new_message'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Deliberately no INSERT/DELETE policy for any client role. Rows are written only by
-- create_notification() below (SECURITY DEFINER), called from triggers and from
-- review_verification() — a client can never forge a notification to itself or write
-- into another user's feed.

-- ============================================================================
-- 2. PUSH_TOKENS (schema only in this migration — sending comes in a later phase)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_select_own" ON public.push_tokens;
CREATE POLICY "push_tokens_select_own" ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_tokens_insert_own" ON public.push_tokens;
CREATE POLICY "push_tokens_insert_own" ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_tokens_update_own" ON public.push_tokens;
CREATE POLICY "push_tokens_update_own" ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_tokens_delete_own" ON public.push_tokens;
CREATE POLICY "push_tokens_delete_own" ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. create_notification() — the single write path for `notifications`
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data);
END;
$$;

-- Not granted to anon/authenticated: only same-owner SECURITY DEFINER functions
-- (the triggers below, and review_verification()) call this directly.
REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;

-- ============================================================================
-- 4. join_requests triggers
-- ============================================================================

-- Fires on every new row. Two cases share one trigger because both originate from an
-- INSERT: the normal request-to-join path (status starts 'pending', notify the host) and
-- an auto-approved invite from the host (inviteToEvent inserts status='approved' directly
-- — see AppProvider.tsx's inviteToEvent — which never fires the status-change trigger
-- below since there's no prior row to compare against).
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
  ELSIF NEW.status = 'approved' AND NEW.user_id <> v_event.creator_id THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'join_request_approved',
      'You''re approved for ' || v_event.title,
      'Open the event to view details and chat.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id, 'actorId', v_event.creator_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_join_request_insert ON public.join_requests;
CREATE TRIGGER notify_join_request_insert
  AFTER INSERT ON public.join_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_join_request_insert();

-- Fires when a host approves/rejects an existing pending request.
CREATE OR REPLACE FUNCTION public.handle_join_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT id, title INTO v_event FROM public.events WHERE id = NEW.event_id;
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
      'Try another plan or request a different event.',
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_join_request_status_change ON public.join_requests;
CREATE TRIGGER notify_join_request_status_change
  AFTER UPDATE OF status ON public.join_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_join_request_status_change();

-- ============================================================================
-- 5. messages trigger — notify every other approved participant of a new chat message
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_sender_name TEXT;
  v_recipient UUID;
BEGIN
  SELECT id, title, creator_id INTO v_event FROM public.events WHERE id = NEW.event_id;
  IF v_event.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, 'Someone') INTO v_sender_name FROM public.profiles WHERE id = NEW.user_id;

  -- UNION (not UNION ALL) dedupes the creator against the approved-joiner list for free.
  FOR v_recipient IN
    SELECT v_event.creator_id
    UNION
    SELECT user_id FROM public.join_requests WHERE event_id = NEW.event_id AND status = 'approved'
  LOOP
    IF v_recipient <> NEW.user_id THEN
      PERFORM public.create_notification(
        v_recipient,
        'new_message',
        v_sender_name || ' in ' || v_event.title,
        left(NEW.text, 140),
        jsonb_build_object('route', '/chat/' || v_event.id, 'eventId', v_event.id, 'actorId', NEW.user_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_message ON public.messages;
CREATE TRIGGER notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- ============================================================================
-- 6. review_verification() (007) — extended to notify on decision
-- ============================================================================

CREATE OR REPLACE FUNCTION public.review_verification(
  target_user_id UUID,
  decision TEXT,
  rejection_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision: %', decision;
  END IF;

  INSERT INTO public.verification_reviews (user_id, reviewer_id, decision, reason, aadhaar_front_uri, aadhaar_back_uri, selfie_uri)
  SELECT target_user_id, auth.uid(), decision, rejection_reason,
         vd.aadhaar_front_uri, vd.aadhaar_back_uri, vd.selfie_uri
  FROM public.verification_documents vd
  WHERE vd.user_id = target_user_id;

  UPDATE public.profiles
  SET verification_status = decision,
      verification_rejection_reason = CASE WHEN decision = 'rejected' THEN rejection_reason ELSE NULL END,
      verified = (decision = 'approved')
  WHERE id = target_user_id;

  PERFORM public.create_notification(
    target_user_id,
    CASE WHEN decision = 'approved' THEN 'verification_approved' ELSE 'verification_rejected' END,
    CASE WHEN decision = 'approved' THEN 'You''re verified!' ELSE 'Verification not approved' END,
    CASE WHEN decision = 'approved' THEN 'Your profile now shows the verified badge.'
         ELSE COALESCE(rejection_reason, 'Please review and resubmit your documents.') END,
    jsonb_build_object('route', '/verification')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_verification(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_verification(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 7. Realtime — let the in-app inbox subscribe live, same as messages (005)
-- ============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
