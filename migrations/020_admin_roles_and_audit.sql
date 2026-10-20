-- Open Plans - Admin roles, permissions, audit log, team management
-- Why:
--   1. Anyone in admin_users had full power, including every Aadhaar photo and chat. Admins now
--      have a role (owner/admin/moderator/support/analyst) that maps to permission strings in
--      admin_role_permissions, checked by has_admin_permission(). is_admin() keeps its signature
--      (every existing RLS policy keeps working) but now also requires status = 'active'.
--   2. Nothing recorded who did what, apart from verification_reviews. admin_audit_log is an
--      append-only record written inside every admin_* function in the same transaction as the
--      change. admin_access_log records sensitive reads (chats, ID photos).
--   3. Admins were added by hand in the SQL editor. After the first owner, owners add, re-role
--      and disable admins from the admin panel (admin_add_admin / admin_set_role / admin_set_status),
--      with a guard that keeps at least one active owner.
--   4. Admins can read crew_requests, notifications and push_tokens (support and moderation need them).
--      Aadhaar photos need the verification.documents.view permission.
-- Existing admins become owners. Safe to re-run.

-- ============================================================================
-- 1. admin_users: role + status
-- ============================================================================

ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE public.admin_users ALTER COLUMN role SET DEFAULT 'moderator';
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('owner', 'admin', 'moderator', 'support', 'analyst'));
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_status_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_status_check
  CHECK (status IN ('active', 'disabled'));

-- ============================================================================
-- 2. Role -> permission map
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'moderator', 'support', 'analyst')),
  permission TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_role_permissions (role, permission)
SELECT r.role, p.permission
FROM (VALUES
  -- permission                       owner admin moderator support analyst
  ('overview.read',                   true, true, true,  true,  true),
  ('users.read',                      true, true, true,  true,  false),
  ('users.edit',                      true, true, true,  true,  false),
  ('users.sanction',                  true, true, true,  false, false),
  ('users.ban',                       true, true, false, false, false),
  ('users.sessions.revoke',           true, true, false, true,  false),
  ('users.delete',                    true, false, false, false, false),
  ('verification.review',             true, true, true,  false, false),
  ('verification.documents.view',     true, true, true,  false, false),
  ('events.read',                     true, true, true,  true,  false),
  ('events.moderate',                 true, true, true,  false, false),
  ('events.purge',                    true, false, false, false, false),
  ('chat.read',                       true, true, true,  false, false),
  ('chat.moderate',                   true, true, true,  false, false),
  ('reports.manage',                  true, true, true,  false, false),
  ('notifications.read',              true, true, false, true,  false),
  ('broadcasts.send',                 true, true, false, false, false),
  ('config.edit',                     true, true, false, false, false),
  ('team.manage',                     true, false, false, false, false),
  ('audit.read',                      true, true, false, false, false),
  ('system.read',                     true, true, false, false, true)
) AS p(permission, owner, admin, moderator, support, analyst)
CROSS JOIN LATERAL (VALUES
  ('owner', p.owner), ('admin', p.admin), ('moderator', p.moderator), ('support', p.support), ('analyst', p.analyst)
) AS r(role, granted)
WHERE r.granted
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. is_admin() / has_admin_permission()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND status = 'active');
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users a
    JOIN public.admin_role_permissions rp ON rp.role = a.role
    WHERE a.user_id = auth.uid() AND a.status = 'active' AND rp.permission = p_permission
  );
$$;
REVOKE ALL ON FUNCTION public.has_admin_permission(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(TEXT) TO authenticated;

DROP POLICY IF EXISTS "admin_role_permissions_admin_select" ON public.admin_role_permissions;
CREATE POLICY "admin_role_permissions_admin_select" ON public.admin_role_permissions FOR SELECT
  USING (public.is_admin());

-- Raises unless the caller holds the permission. Used at the top of every admin_* function.
CREATE OR REPLACE FUNCTION public.admin_require(p_permission TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_admin_permission(p_permission) THEN
    RAISE EXCEPTION 'You don''t have permission to do that (%).', p_permission USING ERRCODE = '42501';
  END IF;
  RETURN auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.admin_require(TEXT) FROM PUBLIC;

-- ============================================================================
-- 4. Audit + access logs (append-only: no write policies, no grants)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  before JSONB,
  after JSONB,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_log(actor_id, created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_log_select" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_select" ON public.admin_audit_log FOR SELECT
  USING (public.has_admin_permission('audit.read'));

CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resource TEXT NOT NULL,           -- 'chat' | 'verification_documents' | 'export'
  target_id TEXT NOT NULL,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_access_created ON public.admin_access_log(created_at DESC);
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_access_log_select" ON public.admin_access_log;
CREATE POLICY "admin_access_log_select" ON public.admin_access_log FOR SELECT
  USING (public.has_admin_permission('audit.read'));

CREATE OR REPLACE FUNCTION public.admin_log(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_reason TEXT DEFAULT NULL,
  p_before JSONB DEFAULT NULL,
  p_after JSONB DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, actor_role, action, target_type, target_id, reason, before, after, meta)
  VALUES (
    auth.uid(),
    (SELECT role FROM public.admin_users WHERE user_id = auth.uid()),
    p_action, p_target_type, p_target_id, NULLIF(btrim(coalesce(p_reason, '')), ''), p_before, p_after, coalesce(p_meta, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_log(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB) FROM PUBLIC;

-- For actions the admin panel performs with the Auth Admin API (ban login, delete account):
-- the panel calls this first, so the permission check and the audit row happen in Postgres.
CREATE OR REPLACE FUNCTION public.admin_record_action(
  p_permission TEXT,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_reason TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require(p_permission);
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Give a reason of at least 10 characters.';
  END IF;
  RETURN public.admin_log(p_action, p_target_type, p_target_id, p_reason, NULL, NULL, p_meta);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_record_action(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_action(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Shared check for the reason every destructive admin action needs.
CREATE OR REPLACE FUNCTION public.admin_check_reason(p_reason TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Give a reason of at least 10 characters. Other admins will see it.';
  END IF;
  RETURN btrim(p_reason);
END;
$$;

-- ============================================================================
-- 5. Who am I (role + permissions for the admin panel's navigation)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_me()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT * INTO v_admin FROM public.admin_users WHERE user_id = auth.uid() AND status = 'active';
  IF v_admin.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.admin_users SET last_seen_at = now()
  WHERE user_id = auth.uid() AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes');

  RETURN jsonb_build_object(
    'user_id', v_admin.user_id,
    'role', v_admin.role,
    'display_name', v_admin.display_name,
    'permissions', coalesce((SELECT jsonb_agg(permission ORDER BY permission) FROM public.admin_role_permissions WHERE role = v_admin.role), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_me() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_me() TO authenticated;

-- ============================================================================
-- 6. Team management
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_team()
RETURNS TABLE (
  user_id UUID, email TEXT, name TEXT, role TEXT, status TEXT, display_name TEXT,
  created_at TIMESTAMPTZ, last_seen_at TIMESTAMPTZ, invited_by_name TEXT, mfa_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.user_id, u.email::TEXT, p.name, a.role, a.status, a.display_name, a.created_at, a.last_seen_at,
         ip.name,
         EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = a.user_id AND f.status = 'verified')
  FROM public.admin_users a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.profiles ip ON ip.id = a.invited_by
  ORDER BY a.status, a.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_team() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_active_owner_count()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INT FROM public.admin_users WHERE role = 'owner' AND status = 'active';
$$;
REVOKE ALL ON FUNCTION public.admin_active_owner_count() FROM PUBLIC;

-- Adds an existing Open Plans account (by email) as an admin, or re-activates one.
CREATE OR REPLACE FUNCTION public.admin_add_admin(p_email TEXT, p_role TEXT, p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_user UUID;
  v_before JSONB;
BEGIN
  PERFORM public.admin_require('team.manage');
  IF p_role NOT IN ('owner', 'admin', 'moderator', 'support', 'analyst') THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  END IF;

  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(btrim(p_email));
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No account uses that email. Ask them to sign up in the Open Plans app first, then add them here.';
  END IF;

  SELECT to_jsonb(a) INTO v_before FROM public.admin_users a WHERE a.user_id = v_user;

  INSERT INTO public.admin_users (user_id, role, status, invited_by)
  VALUES (v_user, p_role, 'active', auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';

  PERFORM public.admin_log('admin.add', 'admin', v_user::TEXT, v_reason, v_before, jsonb_build_object('role', p_role, 'status', 'active'));
  RETURN v_user;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_add_admin(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_admin(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id UUID, p_role TEXT, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_old RECORD;
BEGIN
  PERFORM public.admin_require('team.manage');
  IF p_role NOT IN ('owner', 'admin', 'moderator', 'support', 'analyst') THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  END IF;
  SELECT * INTO v_old FROM public.admin_users WHERE user_id = p_user_id FOR UPDATE;
  IF v_old.user_id IS NULL THEN
    RAISE EXCEPTION 'That person isn''t an admin.';
  END IF;
  IF v_old.role = 'owner' AND p_role <> 'owner' AND v_old.status = 'active' AND public.admin_active_owner_count() <= 1 THEN
    RAISE EXCEPTION 'There has to be at least one active owner. Make someone else an owner first.';
  END IF;

  UPDATE public.admin_users SET role = p_role WHERE user_id = p_user_id;
  PERFORM public.admin_log('admin.set_role', 'admin', p_user_id::TEXT, v_reason,
    jsonb_build_object('role', v_old.role), jsonb_build_object('role', p_role));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_role(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_status(p_user_id UUID, p_status TEXT, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_old RECORD;
BEGIN
  PERFORM public.admin_require('team.manage');
  IF p_status NOT IN ('active', 'disabled') THEN
    RAISE EXCEPTION 'Unknown status: %', p_status;
  END IF;
  IF p_user_id = auth.uid() AND p_status = 'disabled' THEN
    RAISE EXCEPTION 'You can''t turn off your own access.';
  END IF;
  SELECT * INTO v_old FROM public.admin_users WHERE user_id = p_user_id FOR UPDATE;
  IF v_old.user_id IS NULL THEN
    RAISE EXCEPTION 'That person isn''t an admin.';
  END IF;
  IF v_old.role = 'owner' AND v_old.status = 'active' AND p_status = 'disabled' AND public.admin_active_owner_count() <= 1 THEN
    RAISE EXCEPTION 'There has to be at least one active owner.';
  END IF;

  UPDATE public.admin_users SET status = p_status WHERE user_id = p_user_id;
  PERFORM public.admin_log('admin.set_status', 'admin', p_user_id::TEXT, v_reason,
    jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_status(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 7. Admin read access for support/moderation
-- ============================================================================

DROP POLICY IF EXISTS "crew_requests_admin_select" ON public.crew_requests;
CREATE POLICY "crew_requests_admin_select" ON public.crew_requests FOR SELECT
  USING (public.has_admin_permission('users.read'));

DROP POLICY IF EXISTS "notifications_admin_select" ON public.notifications;
CREATE POLICY "notifications_admin_select" ON public.notifications FOR SELECT
  USING (public.has_admin_permission('notifications.read'));

DROP POLICY IF EXISTS "push_tokens_admin_select" ON public.push_tokens;
CREATE POLICY "push_tokens_admin_select" ON public.push_tokens FOR SELECT
  USING (public.has_admin_permission('notifications.read'));

-- Aadhaar photos: owner, or admins whose role may view ID documents.
DROP POLICY IF EXISTS "verification_documents_select_own_or_admin" ON public.verification_documents;
CREATE POLICY "verification_documents_select_own_or_admin" ON public.verification_documents FOR SELECT
  USING (auth.uid() = user_id OR public.has_admin_permission('verification.documents.view'));

-- ============================================================================
-- 8. review_verification(): permission-checked and audited (replaces 009's version)
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
DECLARE
  v_before TEXT;
BEGIN
  PERFORM public.admin_require('verification.review');

  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision: %', decision;
  END IF;

  SELECT verification_status INTO v_before FROM public.profiles WHERE id = target_user_id;

  INSERT INTO public.verification_reviews (user_id, reviewer_id, decision, reason, aadhaar_front_uri, aadhaar_back_uri, selfie_uri)
  SELECT target_user_id, auth.uid(), decision, rejection_reason,
         vd.aadhaar_front_uri, vd.aadhaar_back_uri, vd.selfie_uri
  FROM public.verification_documents vd
  WHERE vd.user_id = target_user_id;

  -- Tells the profile guard (migration 022) this change comes from an admin.
  PERFORM set_config('toogether.admin_action', 'on', true);

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

  PERFORM public.admin_log('verification.' || decision, 'user', target_user_id::TEXT, rejection_reason,
    jsonb_build_object('verification_status', v_before), jsonb_build_object('verification_status', decision));
END;
$$;
REVOKE ALL ON FUNCTION public.review_verification(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_verification(UUID, TEXT, TEXT) TO authenticated;
