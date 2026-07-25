-- Chat messages need to be broadcast live to everyone in an event's chat.
-- Supabase only streams postgres_changes for tables explicitly added to the
-- `supabase_realtime` publication, so add `messages` to it here. Wrapped in a
-- DO block since ADD TABLE throws if the table is already a member (e.g. if
-- it was enabled manually via the dashboard already).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
