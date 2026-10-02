-- 012_enable_feed_realtime.sql
--
-- Streams `join_requests` and `events` changes to the app (AppProvider's
-- 'feed-realtime' channel), so a host sees a new join request — and a requester
-- sees it approved/rejected — without a manual refresh, and new/edited plans show
-- up in everyone's feed live. Realtime filters each change through the table's
-- existing SELECT RLS policy per subscriber, so nobody receives a row they
-- couldn't already query (join requests: only the requester and the event's
-- host; events: per events_select_all from migration 011).
--
-- The client also re-syncs both tables on every return to the foreground, so the
-- app stays correct without this migration — it just won't update live.
--
-- Same pattern as 005: ADD TABLE throws if the table is already a member.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
