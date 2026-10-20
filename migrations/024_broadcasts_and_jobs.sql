-- Open Plans - Announcements, scheduled maintenance jobs, system health
-- Why:
--   1. Admins had no way to tell people anything. admin_send_broadcast() writes one
--      'admin_announcement' notification per recipient; the existing notifications webhook
--      pushes each one like any other notification. Audience: everyone, a city, or a
--      verification status. A test send goes only to the sender. At most 3 real sends a day.
--   2. Nothing ran on a schedule: cancelled plans, used reset codes and old notifications piled
--      up, and timed suspensions never updated account_status. run_maintenance_jobs() does all of
--      it and records each run in job_runs. The admin panel's cron route calls it hourly with the
--      service role (no pg_cron needed).
--   3. admin_system_stats() feeds the System health page.
-- Needs 020 and 022. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 80),
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 3 AND 300),
  route TEXT,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_test BOOLEAN NOT NULL DEFAULT false,
  recipients INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.broadcasts(created_at DESC);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcasts_admin_select" ON public.broadcasts;
CREATE POLICY "broadcasts_admin_select" ON public.broadcasts FOR SELECT USING (public.is_admin());

-- Audience: {} = everyone; {"city": "Pune"}; {"verification": "approved"}; both combine.
-- Suspended and banned accounts are never included.
CREATE OR REPLACE FUNCTION public.broadcast_recipients(p_audience JSONB)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id FROM public.profiles p
  WHERE p.account_status IN ('active', 'restricted')
    AND (p_audience ->> 'city' IS NULL OR lower(btrim(p.city)) = lower(btrim(p_audience ->> 'city')))
    AND (p_audience ->> 'verification' IS NULL OR p.verification_status = p_audience ->> 'verification');
$$;
REVOKE ALL ON FUNCTION public.broadcast_recipients(JSONB) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_broadcast_audience_count(p_audience JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('broadcasts.send');
  RETURN (SELECT count(*)::INT FROM public.broadcast_recipients(coalesce(p_audience, '{}'::jsonb)));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_broadcast_audience_count(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_audience_count(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_send_broadcast(
  p_title TEXT,
  p_body TEXT,
  p_route TEXT,
  p_audience JSONB,
  p_test BOOLEAN,
  p_reason TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
  v_audience JSONB := jsonb_strip_nulls(coalesce(p_audience, '{}'::jsonb));
  v_data JSONB;
  v_user UUID;
  v_count INT := 0;
  v_id UUID;
BEGIN
  PERFORM public.admin_require('broadcasts.send');
  IF NOT p_test THEN
    v_reason := public.admin_check_reason(p_reason);
    IF (SELECT count(*) FROM public.broadcasts WHERE NOT is_test AND created_at > now() - interval '24 hours') >= 3 THEN
      RAISE EXCEPTION 'You can send at most 3 announcements a day. Try again tomorrow.';
    END IF;
  END IF;
  IF p_route IS NOT NULL AND p_route !~ '^/[A-Za-z0-9/_()\-\[\]]*$' THEN
    RAISE EXCEPTION 'The link has to be an app screen path, like /(tabs)/home.';
  END IF;

  INSERT INTO public.broadcasts (title, body, route, audience, is_test, created_by)
  VALUES (btrim(p_title), btrim(p_body), p_route, v_audience, p_test, auth.uid())
  RETURNING id INTO v_id;

  v_data := jsonb_strip_nulls(jsonb_build_object('route', p_route, 'broadcastId', v_id));

  IF p_test THEN
    PERFORM public.create_notification(auth.uid(), 'admin_announcement', btrim(p_title), btrim(p_body), v_data);
    v_count := 1;
  ELSE
    FOR v_user IN SELECT * FROM public.broadcast_recipients(v_audience) LOOP
      PERFORM public.create_notification(v_user, 'admin_announcement', btrim(p_title), btrim(p_body), v_data);
      v_count := v_count + 1;
    END LOOP;
    PERFORM public.admin_log('broadcast.send', 'broadcast', v_id::TEXT, v_reason, NULL,
      jsonb_build_object('title', p_title, 'audience', v_audience, 'recipients', v_count));
  END IF;

  UPDATE public.broadcasts SET recipients = v_count WHERE id = v_id;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_send_broadcast(TEXT, TEXT, TEXT, JSONB, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast(TEXT, TEXT, TEXT, JSONB, BOOLEAN, TEXT) TO authenticated;

-- ============================================================================
-- Scheduled jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
  rows_affected INT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_runs_job ON public.job_runs(job, started_at DESC);
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_runs_admin_select" ON public.job_runs;
CREATE POLICY "job_runs_admin_select" ON public.job_runs FOR SELECT USING (public.has_admin_permission('system.read'));

CREATE OR REPLACE FUNCTION public.run_job(p_job TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run UUID;
  v_rows INT := 0;
BEGIN
  INSERT INTO public.job_runs (job) VALUES (p_job) RETURNING id INTO v_run;
  BEGIN
    CASE p_job
      WHEN 'lift_expired_sanctions' THEN
        v_rows := public.lift_expired_sanctions();
      WHEN 'purge_cancelled_plans' THEN
        DELETE FROM public.events
        WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '72 hours';
        GET DIAGNOSTICS v_rows = ROW_COUNT;
      WHEN 'cleanup_reset_codes' THEN
        DELETE FROM public.password_reset_otps
        WHERE created_at < now() - interval '24 hours';
        GET DIAGNOSTICS v_rows = ROW_COUNT;
      WHEN 'prune_notifications' THEN
        DELETE FROM public.notifications
        WHERE created_at < now() - interval '90 days' AND (read_at IS NOT NULL OR dismissed_at IS NOT NULL);
        GET DIAGNOSTICS v_rows = ROW_COUNT;
      ELSE
        RAISE EXCEPTION 'Unknown job: %', p_job;
    END CASE;
    UPDATE public.job_runs SET finished_at = now(), status = 'ok', rows_affected = v_rows WHERE id = v_run;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.job_runs SET finished_at = now(), status = 'failed', error = SQLERRM WHERE id = v_run;
  END;
  RETURN jsonb_build_object('job', p_job, 'rows', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.run_job(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_job(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.run_maintenance_jobs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_array(
    public.run_job('lift_expired_sanctions'),
    public.run_job('purge_cancelled_plans'),
    public.run_job('cleanup_reset_codes'),
    public.run_job('prune_notifications')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.run_maintenance_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_maintenance_jobs() TO service_role;

-- ============================================================================
-- System health
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_system_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_require('system.read');
  RETURN jsonb_build_object(
    'notifications_24h', (SELECT count(*) FROM public.notifications WHERE created_at > now() - interval '24 hours'),
    'push_devices', (SELECT count(*) FROM public.push_tokens),
    'push_users', (SELECT count(DISTINCT user_id) FROM public.push_tokens),
    'reset_codes_24h', (SELECT count(*) FROM public.password_reset_otps WHERE created_at > now() - interval '24 hours'),
    'reset_codes_used_24h', (SELECT count(*) FROM public.password_reset_otps WHERE created_at > now() - interval '24 hours' AND consumed_at IS NOT NULL),
    'cancelled_awaiting_purge', (SELECT count(*) FROM public.events WHERE deleted_at IS NOT NULL),
    'active_sanctions', (SELECT count(*) FROM public.user_sanctions WHERE lifted_at IS NULL AND type <> 'warning' AND (ends_at IS NULL OR ends_at > now())),
    'id_photo_sets', (SELECT count(*) FROM public.verification_documents),
    'jobs', coalesce((
      SELECT jsonb_agg(j ORDER BY j.job)
      FROM (
        SELECT DISTINCT ON (job) job, started_at, finished_at, status, rows_affected, error
        FROM public.job_runs ORDER BY job, started_at DESC
      ) j
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_system_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_system_stats() TO authenticated;
