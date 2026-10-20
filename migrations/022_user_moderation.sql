-- Open Plans - Warn, restrict, suspend and ban people; admins act on reports
-- Why:
--   1. There was no way to stop someone. user_sanctions records warnings, restrictions
--      (can't host / join / chat), suspensions and bans with an optional end time. Triggers on
--      events, join_requests, messages, crew_requests and member_reports enforce them for every
--      client, so a restricted person is refused by the database, not just hidden in the UI.
--   2. profiles.account_status mirrors the strongest active sanction for quick display.
--   3. profiles_update_own let anyone change their own verified / verification_status (only an
--      app dev tool was meant to). A guard now keeps those, and account_status, unchanged unless
--      the change comes from an admin function. The only self-service change left is submitting
--      for review (-> 'pending'). The app's dev-only "simulate review" stops working; use the panel.
--   4. Admins can resolve member reports (dismiss / remove from plan / act with a sanction).
--      Reports about a host previously reached nobody who could act.
--   5. Admin profile edits, verification revoke, notes, and signing someone out everywhere.
-- Needs 020 and 021. Safe to re-run.

-- ============================================================================
-- 1. Notification types (adds account_* , verification_revoked, event_cancelled_by_admin, admin_announcement)
-- ============================================================================

DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'join_request_received', 'join_request_approved', 'join_request_rejected', 'join_request_removed',
    'event_invite_received', 'event_invite_accepted', 'event_invite_declined', 'event_time_changed',
    'member_reported', 'crew_request_received', 'crew_request_accepted',
    'verification_approved', 'verification_rejected', 'new_message',
    'account_warning', 'account_restricted', 'account_suspended', 'account_restored',
    'verification_revoked', 'event_cancelled_by_admin', 'admin_announcement'
  ));

-- ============================================================================
-- 2. Tables
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'restricted', 'suspended', 'banned'));
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status) WHERE account_status <> 'active';

CREATE TABLE IF NOT EXISTS public.user_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('warning', 'restrict_host', 'restrict_join', 'restrict_chat', 'suspend', 'ban')),
  message TEXT,                    -- shown to the person
  internal_note TEXT,              -- admins only
  reason TEXT NOT NULL,            -- audit reason
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,             -- null = until lifted
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lift_reason TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb   -- e.g. {"eventId": ..., "fromReports": true}
);
CREATE INDEX IF NOT EXISTS idx_user_sanctions_user ON public.user_sanctions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sanctions_active ON public.user_sanctions(user_id) WHERE lifted_at IS NULL;
ALTER TABLE public.user_sanctions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_sanctions_admin_select" ON public.user_sanctions;
CREATE POLICY "user_sanctions_admin_select" ON public.user_sanctions FOR SELECT
  USING (public.has_admin_permission('users.read'));

CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_notes_user ON public.user_notes(user_id, created_at DESC);
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_notes_admin_select" ON public.user_notes;
CREATE POLICY "user_notes_admin_select" ON public.user_notes FOR SELECT
  USING (public.has_admin_permission('users.read'));

-- Report resolution by admins.
ALTER TABLE public.member_reports ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.member_reports'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%resolution%'
  LOOP
    EXECUTE format('ALTER TABLE public.member_reports DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;
ALTER TABLE public.member_reports ADD CONSTRAINT member_reports_resolution_check
  CHECK (resolution IN ('removed', 'dismissed', 'actioned'));

-- Who cancelled a plan and why (admin cancels, suspended hosts).
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- ============================================================================
-- 3. Restriction checks
-- ============================================================================

-- kind: 'host' | 'join' | 'chat' | 'any' ('any' = suspended or banned)
CREATE OR REPLACE FUNCTION public.user_has_restriction(p_user_id UUID, p_kind TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_sanctions
    WHERE user_id = p_user_id
      AND lifted_at IS NULL
      AND (ends_at IS NULL OR ends_at > now())
      AND (type IN ('suspend', 'ban') OR type = 'restrict_' || p_kind)
  );
$$;
REVOKE ALL ON FUNCTION public.user_has_restriction(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_restriction(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    IF public.user_has_restriction(NEW.creator_id, 'host') THEN
      RAISE EXCEPTION 'Your account can''t post plans right now.' USING ERRCODE = 'P0001', HINT = 'account_restricted';
    END IF;

  ELSIF TG_TABLE_NAME = 'join_requests' THEN
    IF NEW.status = 'invited' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'invited') AND NOT public.cfg_flag('invites', true) THEN
      RAISE EXCEPTION 'Invites are turned off right now.';
    END IF;
    IF NEW.status IN ('pending', 'approved') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
       AND public.user_has_restriction(NEW.user_id, 'join') THEN
      RAISE EXCEPTION 'This account can''t join plans right now.' USING HINT = 'account_restricted';
    END IF;

  ELSIF TG_TABLE_NAME = 'messages' THEN
    IF public.user_has_restriction(NEW.user_id, 'chat') THEN
      RAISE EXCEPTION 'Your account can''t send messages right now.' USING HINT = 'account_restricted';
    END IF;

  ELSIF TG_TABLE_NAME = 'crew_requests' THEN
    IF NOT public.cfg_flag('crew', true) THEN
      RAISE EXCEPTION 'Crew is turned off right now.';
    END IF;
    IF public.user_has_restriction(NEW.from_user_id, 'any') THEN
      RAISE EXCEPTION 'Your account can''t add people right now.' USING HINT = 'account_restricted';
    END IF;

  ELSIF TG_TABLE_NAME = 'member_reports' THEN
    IF NOT public.cfg_flag('reports', true) THEN
      RAISE EXCEPTION 'Reporting is turned off right now. Contact support instead.';
    END IF;
    IF public.user_has_restriction(NEW.reporter_id, 'any') THEN
      RAISE EXCEPTION 'Your account can''t send reports right now.' USING HINT = 'account_restricted';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_restrictions_events ON public.events;
CREATE TRIGGER enforce_restrictions_events BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restrictions();
DROP TRIGGER IF EXISTS enforce_restrictions_join_requests ON public.join_requests;
CREATE TRIGGER enforce_restrictions_join_requests BEFORE INSERT OR UPDATE OF status ON public.join_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restrictions();
DROP TRIGGER IF EXISTS enforce_restrictions_messages ON public.messages;
CREATE TRIGGER enforce_restrictions_messages BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restrictions();
DROP TRIGGER IF EXISTS enforce_restrictions_crew ON public.crew_requests;
CREATE TRIGGER enforce_restrictions_crew BEFORE INSERT ON public.crew_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restrictions();
DROP TRIGGER IF EXISTS enforce_restrictions_reports ON public.member_reports;
CREATE TRIGGER enforce_restrictions_reports BEFORE INSERT ON public.member_reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restrictions();

-- ============================================================================
-- 4. Protected profile fields
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('toogether.admin_action', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- profiles_insert_own lets people create their own row; it always starts unverified and active.
  IF TG_OP = 'INSERT' THEN
    NEW.account_status := 'active';
    NEW.verified := false;
    IF NEW.verification_status IS DISTINCT FROM 'unverified' THEN
      NEW.verification_status := 'unverified';
    END IF;
    RETURN NEW;
  END IF;

  NEW.account_status := OLD.account_status;
  NEW.verified := OLD.verified;
  -- Submitting for review is the only self-service status change.
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NOT (NEW.verification_status = 'pending' AND OLD.verification_status IN ('unverified', 'rejected')) THEN
    NEW.verification_status := OLD.verification_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_before_update ON public.profiles;
CREATE TRIGGER protect_profile_fields_before_update BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- Recomputes account_status from active sanctions.
CREATE OR REPLACE FUNCTION public.refresh_account_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT CASE
           WHEN bool_or(type = 'ban') THEN 'banned'
           WHEN bool_or(type = 'suspend') THEN 'suspended'
           WHEN bool_or(type LIKE 'restrict_%') THEN 'restricted'
           ELSE 'active'
         END
  INTO v_status
  FROM public.user_sanctions
  WHERE user_id = p_user_id AND lifted_at IS NULL AND (ends_at IS NULL OR ends_at > now());

  PERFORM set_config('toogether.admin_action', 'on', true);
  UPDATE public.profiles SET account_status = coalesce(v_status, 'active')
  WHERE id = p_user_id AND account_status IS DISTINCT FROM coalesce(v_status, 'active');
  RETURN coalesce(v_status, 'active');
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_account_status(UUID) FROM PUBLIC;

-- What the app shows a restricted or suspended person (no internal notes).
CREATE OR REPLACE FUNCTION public.my_account_status()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', coalesce((SELECT account_status FROM public.profiles WHERE id = auth.uid()), 'active'),
    'sanctions', coalesce((
      SELECT jsonb_agg(jsonb_build_object('type', type, 'message', message, 'ends_at', ends_at) ORDER BY created_at DESC)
      FROM public.user_sanctions
      WHERE user_id = auth.uid() AND type <> 'warning' AND lifted_at IS NULL AND (ends_at IS NULL OR ends_at > now())
    ), '[]'::jsonb),
    'support', public.cfg('contact.support')
  );
$$;
REVOKE ALL ON FUNCTION public.my_account_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_account_status() TO authenticated;

-- ============================================================================
-- 5. Status-change notifications: admin removals and the configurable attempt limit
--    (replaces 014's version; only the 'rejected' and 'removed' branches change)
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

  IF NEW.status = 'approved' AND OLD.status = 'invited' THEN
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
      CASE WHEN NEW.attempts < public.cfg_int('limits.join', 'max_attempts', 3)
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
      CASE WHEN current_setting('toogether.admin_action', true) = 'on'
        THEN 'Open Plans removed you from this plan after a review.'
        ELSE 'The host removed you from this plan.'
      END,
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

-- ============================================================================
-- 6. Admin actions on people
-- ============================================================================

-- Cancels a plan and tells everyone going. Shared by sanctions and plan moderation (023).
CREATE OR REPLACE FUNCTION public.admin_cancel_event_internal(p_event_id UUID, p_reason TEXT, p_body TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_member UUID;
  v_count INT := 0;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF v_event.id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.events SET deleted_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason WHERE id = p_event_id;

  FOR v_member IN
    SELECT user_id FROM public.join_requests WHERE event_id = p_event_id AND status = 'approved'
    UNION SELECT v_event.creator_id
  LOOP
    PERFORM public.create_notification(
      v_member,
      'event_cancelled_by_admin',
      v_event.title || ' was cancelled',
      p_body,
      jsonb_build_object('route', '/event/' || v_event.id, 'eventId', v_event.id)
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_cancel_event_internal(UUID, TEXT, TEXT) FROM PUBLIC;

-- p_types: any of warning, restrict_host, restrict_join, restrict_chat, suspend, ban.
-- With p_event_id + a report case, also closes those reports as 'actioned'.
CREATE OR REPLACE FUNCTION public.admin_apply_sanction(
  p_user_id UUID,
  p_types TEXT[],
  p_ends_at TIMESTAMPTZ,
  p_message TEXT,
  p_note TEXT,
  p_reason TEXT,
  p_cancel_upcoming BOOLEAN DEFAULT false,
  p_case_event_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_type TEXT;
  v_before TEXT;
  v_after TEXT;
  v_cancelled INT := 0;
  v_event RECORD;
  v_strong BOOLEAN := p_types && ARRAY['suspend', 'ban'];
BEGIN
  IF p_types IS NULL OR array_length(p_types, 1) IS NULL THEN
    RAISE EXCEPTION 'Choose what to apply.';
  END IF;
  IF 'ban' = ANY (p_types) THEN
    PERFORM public.admin_require('users.ban');
  ELSE
    PERFORM public.admin_require('users.sanction');
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You can''t apply this to your own account.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'This person is an admin. Turn off their admin access in Team and roles first.';
  END IF;
  IF p_ends_at IS NOT NULL AND p_ends_at <= now() THEN
    RAISE EXCEPTION 'The end time has to be in the future.';
  END IF;

  SELECT account_status INTO v_before FROM public.profiles WHERE id = p_user_id;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'That person no longer exists.';
  END IF;

  FOREACH v_type IN ARRAY p_types LOOP
    IF v_type NOT IN ('warning', 'restrict_host', 'restrict_join', 'restrict_chat', 'suspend', 'ban') THEN
      RAISE EXCEPTION 'Unknown action: %', v_type;
    END IF;
    INSERT INTO public.user_sanctions (user_id, type, message, internal_note, reason, created_by, ends_at, context)
    VALUES (p_user_id, v_type, NULLIF(btrim(coalesce(p_message, '')), ''), NULLIF(btrim(coalesce(p_note, '')), ''), v_reason,
            auth.uid(), CASE WHEN v_type = 'warning' THEN NULL ELSE p_ends_at END,
            jsonb_strip_nulls(jsonb_build_object('eventId', p_case_event_id)));
  END LOOP;

  IF v_strong THEN
    -- Withdraw their open requests and invites to plans that haven't started.
    DELETE FROM public.join_requests jr
    USING public.events e
    WHERE jr.event_id = e.id AND jr.user_id = p_user_id AND jr.status IN ('pending', 'invited') AND e.date_time > now();

    IF p_cancel_upcoming THEN
      FOR v_event IN SELECT id FROM public.events WHERE creator_id = p_user_id AND deleted_at IS NULL AND date_time > now() LOOP
        PERFORM public.admin_cancel_event_internal(v_event.id, 'Host account suspended: ' || v_reason,
          'Open Plans cancelled this plan. Look for another plan nearby.');
        v_cancelled := v_cancelled + 1;
      END LOOP;
    END IF;
  END IF;

  IF p_case_event_id IS NOT NULL THEN
    UPDATE public.member_reports SET resolved_at = now(), resolution = 'actioned', resolved_by = auth.uid()
    WHERE event_id = p_case_event_id AND reported_id = p_user_id AND resolved_at IS NULL;
  END IF;

  v_after := public.refresh_account_status(p_user_id);

  PERFORM public.create_notification(
    p_user_id,
    CASE
      WHEN p_types = ARRAY['warning'] THEN 'account_warning'
      WHEN v_strong THEN 'account_suspended'
      ELSE 'account_restricted'
    END,
    CASE
      WHEN p_types = ARRAY['warning'] THEN 'A warning from Open Plans'
      WHEN 'ban' = ANY (p_types) THEN 'Your account has been closed'
      WHEN v_strong THEN 'Your account is suspended'
      ELSE 'Some features are paused on your account'
    END,
    coalesce(NULLIF(btrim(coalesce(p_message, '')), ''), 'Contact support if you think this is a mistake.'),
    jsonb_build_object('route', '/settings')
  );

  PERFORM public.admin_log('user.sanction', 'user', p_user_id::TEXT, v_reason,
    jsonb_build_object('account_status', v_before),
    jsonb_build_object('account_status', v_after, 'types', to_jsonb(p_types), 'ends_at', p_ends_at, 'cancelled_plans', v_cancelled),
    jsonb_strip_nulls(jsonb_build_object('eventId', p_case_event_id)));

  RETURN jsonb_build_object('account_status', v_after, 'cancelled_plans', v_cancelled);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_apply_sanction(UUID, TEXT[], TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_sanction(UUID, TEXT[], TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN, UUID) TO authenticated;

-- Lifts every active sanction (except warnings, which are history) on a person.
CREATE OR REPLACE FUNCTION public.admin_lift_sanctions(p_user_id UUID, p_reason TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_before TEXT;
  v_after TEXT;
  v_had_ban BOOLEAN;
BEGIN
  SELECT bool_or(type = 'ban') INTO v_had_ban FROM public.user_sanctions
  WHERE user_id = p_user_id AND lifted_at IS NULL AND type <> 'warning';
  IF v_had_ban IS NULL THEN
    RAISE EXCEPTION 'There''s nothing active to lift.';
  END IF;
  PERFORM public.admin_require(CASE WHEN v_had_ban THEN 'users.ban' ELSE 'users.sanction' END);

  SELECT account_status INTO v_before FROM public.profiles WHERE id = p_user_id;
  UPDATE public.user_sanctions SET lifted_at = now(), lifted_by = auth.uid(), lift_reason = v_reason
  WHERE user_id = p_user_id AND lifted_at IS NULL AND type <> 'warning';
  v_after := public.refresh_account_status(p_user_id);

  PERFORM public.create_notification(p_user_id, 'account_restored', 'Your account is back to normal',
    'You can use everything in Open Plans again.', jsonb_build_object('route', '/(tabs)/home'));
  PERFORM public.admin_log('user.lift_sanctions', 'user', p_user_id::TEXT, v_reason,
    jsonb_build_object('account_status', v_before), jsonb_build_object('account_status', v_after));
  RETURN v_after;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_lift_sanctions(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_lift_sanctions(UUID, TEXT) TO authenticated;

-- For the scheduled job: sanctions whose end time passed stop counting automatically
-- (user_has_restriction checks ends_at); this keeps account_status in step and tells the person.
CREATE OR REPLACE FUNCTION public.lift_expired_sanctions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_count INT := 0;
BEGIN
  FOR v_user IN
    SELECT DISTINCT s.user_id FROM public.user_sanctions s
    WHERE s.lifted_at IS NULL AND s.ends_at IS NOT NULL AND s.ends_at <= now() AND s.type <> 'warning'
  LOOP
    UPDATE public.user_sanctions SET lifted_at = now(), lift_reason = 'Ended on schedule'
    WHERE user_id = v_user AND lifted_at IS NULL AND ends_at IS NOT NULL AND ends_at <= now() AND type <> 'warning';
    IF public.refresh_account_status(v_user) = 'active' THEN
      PERFORM public.create_notification(v_user, 'account_restored', 'Your account is back to normal',
        'You can use everything in Open Plans again.', jsonb_build_object('route', '/(tabs)/home'));
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.lift_expired_sanctions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lift_expired_sanctions() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_profile(p_user_id UUID, p_name TEXT, p_username TEXT, p_city TEXT, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_old RECORD;
  v_name TEXT := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_username TEXT := lower(btrim(coalesce(p_username, '')));
BEGIN
  PERFORM public.admin_require('users.edit');
  SELECT name, username, city INTO v_old FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person no longer exists.';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 40 THEN
    RAISE EXCEPTION 'Names need 2 to 40 characters.';
  END IF;
  IF v_username !~ '^[a-z0-9._]{3,30}$' THEN
    RAISE EXCEPTION 'Usernames need 3 to 30 letters, numbers, dots or underscores.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_username AND id <> p_user_id) THEN
    RAISE EXCEPTION 'Someone else already uses @%.', v_username;
  END IF;

  UPDATE public.profiles SET name = v_name, username = v_username, city = NULLIF(btrim(coalesce(p_city, '')), '')
  WHERE id = p_user_id;
  PERFORM public.admin_log('user.edit_profile', 'user', p_user_id::TEXT, v_reason, to_jsonb(v_old),
    jsonb_build_object('name', v_name, 'username', v_username, 'city', NULLIF(btrim(coalesce(p_city, '')), '')));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Clears the profile photo (the Cloudinary file itself is removed by the panel when it has the secret).
CREATE OR REPLACE FUNCTION public.admin_remove_avatar(p_user_id UUID, p_reason TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_old TEXT;
BEGIN
  PERFORM public.admin_require('users.edit');
  SELECT avatar_uri INTO v_old FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'They don''t have a profile photo.';
  END IF;
  UPDATE public.profiles SET avatar_uri = NULL WHERE id = p_user_id;
  PERFORM public.admin_log('user.remove_avatar', 'user', p_user_id::TEXT, v_reason, jsonb_build_object('avatar_uri', v_old), NULL);
  RETURN v_old;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_avatar(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_avatar(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_verification(p_user_id UUID, p_reason TEXT, p_message TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
BEGIN
  PERFORM public.admin_require('verification.review');
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND verification_status = 'approved') THEN
    RAISE EXCEPTION 'Only a verified ID can be revoked.';
  END IF;
  PERFORM set_config('toogether.admin_action', 'on', true);
  UPDATE public.profiles
  SET verification_status = 'unverified', verified = false,
      verification_rejection_reason = NULLIF(btrim(coalesce(p_message, '')), '')
  WHERE id = p_user_id;
  PERFORM public.create_notification(p_user_id, 'verification_revoked', 'Your ID verification was removed',
    coalesce(NULLIF(btrim(coalesce(p_message, '')), ''), 'Please verify your ID again.'), jsonb_build_object('route', '/verification'));
  PERFORM public.admin_log('verification.revoke', 'user', p_user_id::TEXT, v_reason,
    jsonb_build_object('verification_status', 'approved'), jsonb_build_object('verification_status', 'unverified'));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revoke_verification(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_verification(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_note(p_user_id UUID, p_body TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  PERFORM public.admin_require('users.read');
  INSERT INTO public.user_notes (user_id, author_id, body) VALUES (p_user_id, auth.uid(), btrim(p_body)) RETURNING id INTO v_id;
  PERFORM public.admin_log('user.add_note', 'user', p_user_id::TEXT, NULL, NULL, jsonb_build_object('note_id', v_id));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_add_note(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_note(UUID, TEXT) TO authenticated;

-- Ends every session; access tokens already issued stop working when they expire (about an hour).
CREATE OR REPLACE FUNCTION public.admin_revoke_sessions(p_user_id UUID, p_reason TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_count INT;
BEGIN
  PERFORM public.admin_require('users.sessions.revoke');
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::TEXT;
  PERFORM public.admin_log('user.revoke_sessions', 'user', p_user_id::TEXT, v_reason, NULL, jsonb_build_object('sessions', v_count));
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revoke_sessions(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_sessions(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 7. Admin actions on reports
-- ============================================================================

-- p_action: 'dismiss' (close, no change) | 'remove' (take the person out of the plan).
CREATE OR REPLACE FUNCTION public.admin_resolve_reports(p_event_id UUID, p_reported_id UUID, p_action TEXT, p_reason TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_count INT;
  v_host UUID;
BEGIN
  PERFORM public.admin_require('reports.manage');
  IF p_action NOT IN ('dismiss', 'remove') THEN
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
  SELECT creator_id INTO v_host FROM public.events WHERE id = p_event_id;

  IF p_action = 'remove' THEN
    IF v_host = p_reported_id THEN
      RAISE EXCEPTION 'A host can''t be removed from their own plan. Cancel the plan or suspend the host instead.';
    END IF;
    PERFORM set_config('toogether.admin_action', 'on', true);
    UPDATE public.join_requests SET status = 'removed'
    WHERE event_id = p_event_id AND user_id = p_reported_id AND status = 'approved';
  END IF;

  UPDATE public.member_reports
  SET resolved_at = now(), resolution = CASE WHEN p_action = 'remove' THEN 'removed' ELSE 'dismissed' END, resolved_by = auth.uid()
  WHERE event_id = p_event_id AND reported_id = p_reported_id AND resolved_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'These reports were already closed.';
  END IF;

  PERFORM public.admin_log('reports.' || p_action, 'user', p_reported_id::TEXT, v_reason, NULL,
    jsonb_build_object('reports', v_count), jsonb_build_object('eventId', p_event_id));
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_reports(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_reports(UUID, UUID, TEXT, TEXT) TO authenticated;
