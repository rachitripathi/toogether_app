-- Open Plans - Remote config the admin panel controls
-- Why: every rule (group size, how far ahead a plan can start, join attempts, categories, the
-- monetisation switch) was a constant in the app and a literal in SQL, so changing one needed an
-- app release or a migration. app_config holds them once:
--   - 'public' keys are readable by the app (anon + authenticated) so it can follow them;
--   - the SQL rules below read the same keys through cfg(), so the database enforces exactly
--     what the panel shows. Seeded with today's values, so this migration changes no behaviour.
-- Writes only through admin_set_config() (config.edit permission, reason required, history kept).
-- Needs 020. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  scope TEXT NOT NULL DEFAULT 'public' CHECK (scope IN ('public', 'server')),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_select" ON public.app_config;
CREATE POLICY "app_config_select" ON public.app_config FOR SELECT
  USING (scope = 'public' OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.app_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_config_history_key ON public.app_config_history(key, created_at DESC);
ALTER TABLE public.app_config_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config_history_select" ON public.app_config_history;
CREATE POLICY "app_config_history_select" ON public.app_config_history FOR SELECT
  USING (public.is_admin());

INSERT INTO public.app_config (key, value, scope, description) VALUES
  ('app.maintenance', '{"enabled": false, "message": ""}', 'public',
   'Blocks the app for everyone except admins and shows the message.'),
  ('app.min_version', '{"android": null, "ios": null, "message": "Please update Open Plans to keep using it."}', 'public',
   'People on an older app version must update before continuing.'),
  ('app.announcement_banner', '{"enabled": false, "text": "", "link": null}', 'public',
   'A banner at the top of Home.'),
  ('flags.features', '{"crew": true, "invites": true, "reports": true, "women_only": true, "credits": false, "verification_required_to_host": false}', 'public',
   'Turns whole features on or off.'),
  ('limits.plan', '{"max_people_min": 2, "max_people_max": 10, "min_lead_minutes": 15, "max_lead_days": 31, "title_min": 3, "title_max": 60, "description_max": 200}', 'public',
   'Rules for creating a plan.'),
  ('limits.join', '{"max_attempts": 3}', 'public',
   'Requests per plan, counting the first one.'),
  ('limits.usage', '{"free_joins": 5, "verified_bonus": 5, "free_creates": 3}', 'public',
   'Monthly free limits, only used when credits are on.'),
  ('categories.enabled', '["movies", "chill", "music", "sports", "food", "travel", "gaming", "other"]', 'public',
   'Categories people can pick for a new plan.'),
  ('content.safety_tips', '["Always meet in a public place, especially the first time.", "Bring a friend along, or tell someone where you''re going.", "Don''t share personal info like your home address, ID, or bank details in chat.", "Keep the conversation in the app until you actually trust the person.", "Arrange your own way there and back. Never rely on a stranger for a ride.", "Trust your gut. If something feels off, leave. It''s always okay to back out."]', 'public',
   'Safety tips shown before meeting people.'),
  ('contact.support', '{"email": "", "message": "Questions about your account? Write to us."}', 'public',
   'How people reach support, shown on the suspended screen and in Settings.')
ON CONFLICT (key) DO NOTHING;

-- Reads one config value. SECURITY DEFINER so triggers running as any user can read 'server' keys.
CREATE OR REPLACE FUNCTION public.cfg(p_key TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT value FROM public.app_config WHERE key = p_key;
$$;
REVOKE ALL ON FUNCTION public.cfg(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cfg(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cfg_int(p_key TEXT, p_field TEXT, p_default INT)
RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce((public.cfg(p_key) ->> p_field)::INT, p_default);
$$;

CREATE OR REPLACE FUNCTION public.cfg_flag(p_field TEXT, p_default BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce((public.cfg('flags.features') ->> p_field)::BOOLEAN, p_default);
$$;

-- Shape checks so a bad value can never reach the app or the triggers.
CREATE OR REPLACE FUNCTION public.validate_config(p_key TEXT, p_value JSONB)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_min INT;
  v_max INT;
BEGIN
  CASE p_key
    WHEN 'app.maintenance' THEN
      IF jsonb_typeof(p_value -> 'enabled') <> 'boolean' THEN RAISE EXCEPTION 'Maintenance mode needs enabled: true or false.'; END IF;
      IF (p_value ->> 'enabled')::BOOLEAN AND length(btrim(coalesce(p_value ->> 'message', ''))) < 10 THEN
        RAISE EXCEPTION 'Write a message of at least 10 characters for people to see.';
      END IF;
    WHEN 'app.min_version' THEN
      IF coalesce(p_value ->> 'android', '0.0.0') !~ '^\d+\.\d+\.\d+$' OR coalesce(p_value ->> 'ios', '0.0.0') !~ '^\d+\.\d+\.\d+$' THEN
        RAISE EXCEPTION 'Versions look like 1.4.0.';
      END IF;
    WHEN 'limits.plan' THEN
      v_min := (p_value ->> 'max_people_min')::INT;
      v_max := (p_value ->> 'max_people_max')::INT;
      IF v_min IS NULL OR v_max IS NULL OR v_min < 2 OR v_max > 50 OR v_min > v_max THEN
        RAISE EXCEPTION 'Group size must be between 2 and 50, with the smallest no bigger than the largest.';
      END IF;
      IF (p_value ->> 'min_lead_minutes')::INT NOT BETWEEN 0 AND 1440 THEN RAISE EXCEPTION 'Earliest start must be 0 to 1440 minutes.'; END IF;
      IF (p_value ->> 'max_lead_days')::INT NOT BETWEEN 1 AND 365 THEN RAISE EXCEPTION 'Furthest start must be 1 to 365 days.'; END IF;
      IF (p_value ->> 'title_max')::INT NOT BETWEEN 10 AND 120 OR (p_value ->> 'title_min')::INT NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Title length limits are out of range.'; END IF;
      IF (p_value ->> 'description_max')::INT NOT BETWEEN 50 AND 2000 THEN RAISE EXCEPTION 'Description limit must be 50 to 2000.'; END IF;
    WHEN 'limits.join' THEN
      IF (p_value ->> 'max_attempts')::INT NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Requests per plan must be 1 to 10.'; END IF;
    WHEN 'limits.usage' THEN
      IF (p_value ->> 'free_joins')::INT < 0 OR (p_value ->> 'free_creates')::INT < 0 OR (p_value ->> 'verified_bonus')::INT < 0 THEN
        RAISE EXCEPTION 'Limits can''t be negative.';
      END IF;
    WHEN 'categories.enabled' THEN
      IF jsonb_typeof(p_value) <> 'array' OR jsonb_array_length(p_value) = 0 THEN RAISE EXCEPTION 'Keep at least one category on.'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_value) c WHERE c NOT IN ('movies', 'chill', 'music', 'sports', 'food', 'travel', 'gaming', 'other')) THEN
        RAISE EXCEPTION 'Unknown category in the list.';
      END IF;
    WHEN 'content.safety_tips' THEN
      IF jsonb_typeof(p_value) <> 'array' OR jsonb_array_length(p_value) = 0 THEN RAISE EXCEPTION 'Keep at least one safety tip.'; END IF;
    ELSE
      NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_config(p_key TEXT, p_value JSONB, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_old JSONB;
BEGIN
  PERFORM public.admin_require('config.edit');
  SELECT value INTO v_old FROM public.app_config WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown setting: %', p_key;
  END IF;
  IF v_old = p_value THEN
    RETURN;
  END IF;
  PERFORM public.validate_config(p_key, p_value);

  UPDATE public.app_config SET value = p_value, updated_at = now(), updated_by = auth.uid() WHERE key = p_key;
  INSERT INTO public.app_config_history (key, old_value, new_value, actor_id, reason) VALUES (p_key, v_old, p_value, auth.uid(), v_reason);
  PERFORM public.admin_log('config.update', 'config', p_key, v_reason, v_old, p_value);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_config(TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_config(TEXT, JSONB, TEXT) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Rules that now read config (same messages and same values as before at the seeded config)
-- ============================================================================

-- Replaces 016's version.
CREATE OR REPLACE FUNCTION public.validate_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_title_min INT := public.cfg_int('limits.plan', 'title_min', 3);
  v_title_max INT := public.cfg_int('limits.plan', 'title_max', 60);
  v_desc_max INT := public.cfg_int('limits.plan', 'description_max', 200);
  v_min INT := public.cfg_int('limits.plan', 'max_people_min', 2);
  v_max INT := public.cfg_int('limits.plan', 'max_people_max', 10);
  v_lead INT := public.cfg_int('limits.plan', 'min_lead_minutes', 15);
  v_ahead INT := public.cfg_int('limits.plan', 'max_lead_days', 31);
  v_categories JSONB := public.cfg('categories.enabled');
BEGIN
  IF length(btrim(coalesce(NEW.title, ''))) < v_title_min THEN
    RAISE EXCEPTION 'Give the plan a title of at least % characters.', v_title_min;
  END IF;
  IF length(NEW.title) > v_title_max THEN
    RAISE EXCEPTION 'Plan titles can be at most % characters.', v_title_max;
  END IF;
  IF length(btrim(coalesce(NEW.area, ''))) = 0 THEN
    RAISE EXCEPTION 'Add the locality shown publicly.';
  END IF;
  IF length(btrim(coalesce(NEW.exact_location, ''))) = 0 THEN
    RAISE EXCEPTION 'Add the exact address.';
  END IF;
  IF length(coalesce(NEW.description, '')) > v_desc_max THEN
    RAISE EXCEPTION 'Descriptions can be at most % characters.', v_desc_max;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.max_people IS NULL THEN
    RAISE EXCEPTION 'Set how many people can join (% to %, including you).', v_min, v_max;
  END IF;
  IF NEW.max_people IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.max_people IS DISTINCT FROM OLD.max_people)
     AND (NEW.max_people < v_min OR NEW.max_people > v_max) THEN
    RAISE EXCEPTION 'Group size must be between % and %, including you.', v_min, v_max;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.date_time IS DISTINCT FROM OLD.date_time THEN
    IF NEW.date_time <= now() + make_interval(mins => v_lead) THEN
      RAISE EXCEPTION 'Plans need to start at least % minutes from now.', v_lead;
    END IF;
    IF NEW.date_time > now() + make_interval(days => v_ahead + 1) THEN
      RAISE EXCEPTION 'Plans can be scheduled at most % days ahead.', v_ahead;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_categories IS NOT NULL AND NOT (v_categories ? NEW.category) THEN
      RAISE EXCEPTION 'That category isn''t available right now. Pick another one.';
    END IF;
    IF NEW.women_only AND NOT public.cfg_flag('women_only', true) THEN
      RAISE EXCEPTION 'Women-only plans are turned off right now.';
    END IF;
    IF public.cfg_flag('verification_required_to_host', false) AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = NEW.creator_id AND verification_status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Verify your ID to host plans.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Replaces 013's version: the attempt limit comes from limits.join.
CREATE OR REPLACE FUNCTION public.rerequest_to_join(p_event_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_max INT := public.cfg_int('limits.join', 'max_attempts', 3);
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

  IF v_request.attempts >= v_max THEN
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
