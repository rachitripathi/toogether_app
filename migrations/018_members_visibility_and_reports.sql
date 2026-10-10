-- Toogether App - Members can see each other; members can report each other to the host
-- Why:
--   1. `join_requests_select_own` (011) only let a user read their own request (plus the host
--      and admins), so a member never learned who else was going: approvedUserIds came out as
--      just themselves. Approved members can now read the other *approved* rows of plans they're
--      in. Pending/declined requests stay private to the requester and host.
--   2. New `member_reports`: anyone in a plan (host or approved member) can report another
--      person in it, with a written reason. The host sees reports about their members (who
--      reported, the reason, when) and can remove the member or dismiss the report in one step.
--      Reports about the host go to admins only. Admins see everything via is_admin().
-- Safe to re-run.

-- ============================================================================
-- 1. Members can see who else is going
-- ============================================================================

-- is_event_member() (016) is SECURITY DEFINER, so calling it here doesn't recurse into this
-- same policy.
DROP POLICY IF EXISTS "join_requests_select_own" ON public.join_requests;
CREATE POLICY "join_requests_select_own" ON public.join_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid())
    OR (status = 'approved' AND public.is_event_member(event_id))
    OR public.is_admin()
  );

-- ============================================================================
-- 2. Notification type
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
    'member_reported',
    'crew_request_received',
    'crew_request_accepted',
    'verification_approved',
    'verification_rejected',
    'new_message'
  ));

-- ============================================================================
-- 3. member_reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT CHECK (resolution IN ('removed', 'dismissed')),
  CHECK (reporter_id <> reported_id)
);

CREATE INDEX IF NOT EXISTS idx_member_reports_event ON public.member_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_member_reports_reported ON public.member_reports(reported_id);
-- One open report per reporter, person and plan; a new one is allowed once it's resolved.
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_reports_one_open
  ON public.member_reports(event_id, reporter_id, reported_id)
  WHERE resolved_at IS NULL;

ALTER TABLE public.member_reports ENABLE ROW LEVEL SECURITY;

-- Reporter sees their own reports; the host sees reports about anyone but themselves; admins
-- see all. No client INSERT/UPDATE/DELETE: writes go through the functions below.
DROP POLICY IF EXISTS "member_reports_select" ON public.member_reports;
CREATE POLICY "member_reports_select" ON public.member_reports FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = member_reports.event_id
        AND e.creator_id = auth.uid()
        AND member_reports.reported_id <> e.creator_id
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.member_reports;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. report_member() / resolve_member_reports()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.report_member(p_event_id UUID, p_reported_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_event RECORD;
  v_reason TEXT := btrim(coalesce(p_reason, ''));
  v_reporter_name TEXT;
  v_reported_name TEXT;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND deleted_at IS NULL;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'This plan is no longer available.';
  END IF;

  IF v_me <> v_event.creator_id AND NOT EXISTS (
    SELECT 1 FROM public.join_requests WHERE event_id = p_event_id AND user_id = v_me AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only people in this plan can report its members.';
  END IF;

  IF p_reported_id = v_me THEN
    RAISE EXCEPTION 'You can''t report yourself.';
  END IF;
  IF p_reported_id <> v_event.creator_id AND NOT EXISTS (
    SELECT 1 FROM public.join_requests WHERE event_id = p_event_id AND user_id = p_reported_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'That person isn''t in this plan.';
  END IF;

  IF length(v_reason) < 10 THEN
    RAISE EXCEPTION 'Please describe what happened (at least 10 characters).';
  END IF;
  IF length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Please keep the reason under 500 characters.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.member_reports
    WHERE event_id = p_event_id AND reporter_id = v_me AND reported_id = p_reported_id AND resolved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You''ve already reported them for this plan. The host is reviewing it.';
  END IF;

  INSERT INTO public.member_reports (event_id, reporter_id, reported_id, reason)
  VALUES (p_event_id, v_me, p_reported_id, v_reason);

  -- Tell the host, unless the host is the one reported (admins only) or the one reporting.
  IF p_reported_id <> v_event.creator_id AND v_me <> v_event.creator_id THEN
    SELECT COALESCE(name, 'Someone') INTO v_reporter_name FROM public.profiles WHERE id = v_me;
    SELECT COALESCE(name, 'someone') INTO v_reported_name FROM public.profiles WHERE id = p_reported_id;
    PERFORM public.create_notification(
      v_event.creator_id,
      'member_reported',
      v_reporter_name || ' reported ' || v_reported_name || ' in ' || v_event.title,
      'Open the members list to review it and decide.',
      jsonb_build_object('route', '/event-members/' || v_event.id, 'eventId', v_event.id, 'actorId', v_me)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.report_member(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_member(UUID, UUID, TEXT) TO authenticated;

-- Host's decision on every open report about one member: remove them from the plan (same
-- 'removed' status as the Remove button, so they're notified and lose access) or dismiss.
CREATE OR REPLACE FUNCTION public.resolve_member_reports(p_event_id UUID, p_reported_id UUID, p_remove BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id AND creator_id = auth.uid() AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Only the host can act on reports.';
  END IF;

  UPDATE public.member_reports
  SET resolved_at = now(), resolution = CASE WHEN p_remove THEN 'removed' ELSE 'dismissed' END
  WHERE event_id = p_event_id AND reported_id = p_reported_id AND resolved_at IS NULL;

  IF p_remove THEN
    UPDATE public.join_requests
    SET status = 'removed'
    WHERE event_id = p_event_id AND user_id = p_reported_id AND status = 'approved';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_member_reports(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_member_reports(UUID, UUID, BOOLEAN) TO authenticated;
