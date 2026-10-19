-- Open Plans - Karma replaces ratings; crew recommendations
-- Why:
--   1. Star ratings never worked: nobody rates anyone, and they were only ever stored on the
--      phone (MOCK_RATINGS). Karma replaces them. It's earned by doing things (hosting plans,
--      joining plans, building a crew, getting verified) rather than by other people's opinions.
--      It's *derived* from existing rows every time it's read, not stored, so it can't be
--      forged from the client and it corrects itself: cancel a plan or get removed from one and
--      the karma it earned disappears with it. No new table, no triggers.
--   2. get_crew_recommendations(): people to add to your crew, ranked by plans you've shared and
--      mutual crew. Mutual crew can't be worked out on the phone because crew_requests RLS only
--      shows a user their own rows, so this runs SECURITY DEFINER and only returns counts.
-- The old `ratings` table is left in place (unused) so no data is destroyed.
-- Safe to re-run.

-- ============================================================================
-- 1. Karma
-- ============================================================================
-- Points (keep in sync with lib/karma.ts KARMA_RULES):
--   +10  each plan you created that wasn't cancelled
--   +15  each plan you hosted that has started and had at least one approved member
--   +3   each approved member of a plan you hosted that has started
--   +10  each plan you were approved into that wasn't cancelled (hosts don't count here)
--   +5   each crew connection, counted up to 20 connections
--   +25  verified profile
--   -15  each time a host removed you from a plan
--   -20  each plan you cancelled within 24h of its start while people were going
-- Never below 0.
--
-- Cancelled plans earn nothing for anyone, so creating and cancelling, or two accounts joining
-- each other's plans and then cancelling, doesn't farm karma. The crew cap limits fake-account
-- connection farming.

DROP FUNCTION IF EXISTS public.get_karma(UUID[]);
CREATE OR REPLACE FUNCTION public.get_karma(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  karma INT,
  plans_hosted INT,
  plans_hosted_happened INT,
  guests_hosted INT,
  plans_joined INT,
  crew_count INT,
  verified BOOLEAN,
  times_removed INT,
  late_cancels INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH ids AS (
    SELECT DISTINCT unnest(p_user_ids) AS id
  ),
  approved AS (
    SELECT jr.event_id, count(*)::INT AS n
    FROM public.join_requests jr
    WHERE jr.status = 'approved'
    GROUP BY jr.event_id
  ),
  hosted AS (
    SELECT
      e.creator_id AS id,
      count(*) FILTER (WHERE e.deleted_at IS NULL)::INT AS plans_hosted,
      count(*) FILTER (
        WHERE e.deleted_at IS NULL AND e.date_time <= now() AND COALESCE(a.n, 0) > 0
      )::INT AS plans_hosted_happened,
      COALESCE(sum(a.n) FILTER (WHERE e.deleted_at IS NULL AND e.date_time <= now()), 0)::INT AS guests_hosted,
      count(*) FILTER (
        WHERE e.deleted_at IS NOT NULL
          AND e.deleted_at > e.date_time - interval '24 hours'
          AND COALESCE(a.n, 0) > 0
      )::INT AS late_cancels
    FROM public.events e
    LEFT JOIN approved a ON a.event_id = e.id
    WHERE e.creator_id IN (SELECT id FROM ids)
    GROUP BY e.creator_id
  ),
  joined AS (
    SELECT
      jr.user_id AS id,
      count(*) FILTER (WHERE jr.status = 'approved' AND e.deleted_at IS NULL AND e.creator_id <> jr.user_id)::INT AS plans_joined,
      count(*) FILTER (WHERE jr.status = 'removed')::INT AS times_removed
    FROM public.join_requests jr
    JOIN public.events e ON e.id = jr.event_id
    WHERE jr.user_id IN (SELECT id FROM ids)
    GROUP BY jr.user_id
  ),
  crew AS (
    SELECT ids.id, count(DISTINCT CASE WHEN cr.from_user_id = ids.id THEN cr.to_user_id ELSE cr.from_user_id END)::INT AS crew_count
    FROM ids
    JOIN public.crew_requests cr
      ON cr.status = 'accepted' AND (cr.from_user_id = ids.id OR cr.to_user_id = ids.id)
    GROUP BY ids.id
  )
  SELECT
    p.id,
    GREATEST(
      0,
      10 * COALESCE(h.plans_hosted, 0)
      + 15 * COALESCE(h.plans_hosted_happened, 0)
      + 3 * COALESCE(h.guests_hosted, 0)
      + 10 * COALESCE(j.plans_joined, 0)
      + 5 * LEAST(COALESCE(c.crew_count, 0), 20)
      + CASE WHEN p.verification_status = 'approved' OR p.verified THEN 25 ELSE 0 END
      - 15 * COALESCE(j.times_removed, 0)
      - 20 * COALESCE(h.late_cancels, 0)
    )::INT,
    COALESCE(h.plans_hosted, 0),
    COALESCE(h.plans_hosted_happened, 0),
    COALESCE(h.guests_hosted, 0),
    COALESCE(j.plans_joined, 0),
    COALESCE(c.crew_count, 0),
    (p.verification_status = 'approved' OR COALESCE(p.verified, false)),
    COALESCE(j.times_removed, 0),
    COALESCE(h.late_cancels, 0)
  FROM public.profiles p
  JOIN ids ON ids.id = p.id
  LEFT JOIN hosted h ON h.id = p.id
  LEFT JOIN joined j ON j.id = p.id
  LEFT JOIN crew c ON c.id = p.id;
$$;

REVOKE ALL ON FUNCTION public.get_karma(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_karma(UUID[]) TO authenticated;

-- ============================================================================
-- 2. Crew recommendations
-- ============================================================================
-- Candidates: everyone except yourself, your crew, anyone with a pending request either way, and
-- anyone where a request between you was declined (either direction), so a "no" isn't followed
-- by that person being suggested again. Ranked by shared plans (strongest signal: you've met),
-- then mutual crew, then same city. People with none of the three aren't returned.

DROP FUNCTION IF EXISTS public.get_crew_recommendations(INT);
CREATE OR REPLACE FUNCTION public.get_crew_recommendations(p_limit INT DEFAULT 30)
RETURNS TABLE (
  user_id UUID,
  shared_plans INT,
  mutual_crew INT,
  same_city BOOLEAN,
  score INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.id, lower(trim(COALESCE(p.city, ''))) AS city FROM public.profiles p WHERE p.id = auth.uid()
  ),
  participants AS (
    SELECT e.id AS event_id, e.creator_id AS uid
    FROM public.events e
    WHERE e.deleted_at IS NULL
    UNION
    SELECT jr.event_id, jr.user_id
    FROM public.join_requests jr
    JOIN public.events e ON e.id = jr.event_id
    WHERE jr.status = 'approved' AND e.deleted_at IS NULL
  ),
  shared AS (
    SELECT other.uid, count(DISTINCT other.event_id)::INT AS n
    FROM participants mine
    JOIN participants other ON other.event_id = mine.event_id AND other.uid <> mine.uid
    WHERE mine.uid = (SELECT id FROM me)
    GROUP BY other.uid
  ),
  my_crew AS (
    SELECT CASE WHEN cr.from_user_id = (SELECT id FROM me) THEN cr.to_user_id ELSE cr.from_user_id END AS uid
    FROM public.crew_requests cr
    WHERE cr.status = 'accepted'
      AND (cr.from_user_id = (SELECT id FROM me) OR cr.to_user_id = (SELECT id FROM me))
  ),
  mutual AS (
    SELECT CASE WHEN cr.from_user_id = mc.uid THEN cr.to_user_id ELSE cr.from_user_id END AS uid,
           count(DISTINCT mc.uid)::INT AS n
    FROM my_crew mc
    JOIN public.crew_requests cr
      ON cr.status = 'accepted' AND (cr.from_user_id = mc.uid OR cr.to_user_id = mc.uid)
    GROUP BY 1
  ),
  excluded AS (
    SELECT CASE WHEN cr.from_user_id = (SELECT id FROM me) THEN cr.to_user_id ELSE cr.from_user_id END AS uid
    FROM public.crew_requests cr
    WHERE cr.from_user_id = (SELECT id FROM me) OR cr.to_user_id = (SELECT id FROM me)
  ),
  scored AS (
    SELECT
      p.id AS uid,
      COALESCE(s.n, 0) AS shared_plans,
      COALESCE(m.n, 0) AS mutual_crew,
      ((SELECT city FROM me) <> '' AND lower(trim(COALESCE(p.city, ''))) = (SELECT city FROM me)) AS same_city,
      p.created_at
    FROM public.profiles p
    LEFT JOIN shared s ON s.uid = p.id
    LEFT JOIN mutual m ON m.uid = p.id
    WHERE p.id <> (SELECT id FROM me)
      AND p.id NOT IN (SELECT uid FROM excluded)
  )
  SELECT
    uid,
    shared_plans,
    mutual_crew,
    same_city,
    (shared_plans * 10 + mutual_crew * 4 + CASE WHEN same_city THEN 1 ELSE 0 END)::INT AS score
  FROM scored
  WHERE shared_plans > 0 OR mutual_crew > 0 OR same_city
  ORDER BY score DESC, created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.get_crew_recommendations(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_crew_recommendations(INT) TO authenticated;
