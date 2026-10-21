-- Open Plans - karma RPCs are for signed-in users only
-- Why: 019 granted get_karma() and get_crew_recommendations() to `authenticated` after revoking
-- from PUBLIC, but Supabase's default privileges also grant EXECUTE on new public functions to
-- `anon` directly, so logged-out callers with the publishable key could still run them.
-- Applied by hand in the SQL editor on 2026-10-22; this file records it. Safe to re-run.

REVOKE EXECUTE ON FUNCTION public.get_karma(UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_crew_recommendations(INT) FROM anon;
