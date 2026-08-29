-- Toogether App - Push notification delivery (Database Webhook)
-- Version: 1.1
-- Why: 009 populates the `notifications` table (the in-app inbox) but nothing sends an
-- actual OS push notification yet. This wires a Database Webhook so every new
-- `notifications` row fires an HTTP call to the `send-push` Edge Function
-- (supabase/functions/send-push). That function looks up the recipient's `push_tokens` and
-- relays through Expo's hosted push service, which covers both FCM v1 (Android) and APNs
-- (iOS) through the same call — see FUNCTIONALITY.md §9.
--
-- IMPORTANT — how this actually gets created on this project: the underlying mechanism
-- (`supabase_functions.http_request()`, called from a trigger) only exists once a project's
-- Database Webhooks feature has been provisioned at least once, which only happens through
-- the Dashboard. Running this file as raw SQL on an unprovisioned project fails with
-- `schema "supabase_functions" does not exist` — that happened here, so the actual webhook
-- on this project was created via the Dashboard UI instead. As of the 2026 dashboard
-- reorg, Webhooks lives under **Integrations**, not Database:
--   Integrations > Webhooks (https://supabase.com/dashboard/project/najyegewtbeyigppuufy/integrations/webhooks/overview)
--   > Create a new hook
--     Name:   send_push_on_notification
--     Table:  public.notifications
--     Events: Insert
--     Type:   HTTP Request, POST
--     URL:    https://najyegewtbeyigppuufy.supabase.co/functions/v1/send-push
--     Headers: Content-type: application/json
--              Authorization: Bearer sb_publishable_pDw3N9foURXtQxbiTXt2aQ_Ylwziwcs
--
-- This file is kept as the scriptable equivalent for any *other* environment where Webhooks
-- has already been provisioned (or gets provisioned before this runs) — it's a no-op with a
-- notice, not an error, if the schema still isn't there, so it's always safe to run.
--
-- Deploy the function itself separately, in either order:
--   supabase functions deploy send-push
-- `supabase_functions.http_request` fires the HTTP call asynchronously via the pg_net
-- extension and never blocks or fails the INSERT that triggered it, even if the function
-- isn't deployed yet or the call errors.
--
-- Safe to re-run.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'supabase_functions') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS send_push_on_notification ON public.notifications';
    EXECUTE $trigger$
      CREATE TRIGGER send_push_on_notification
        AFTER INSERT ON public.notifications
        FOR EACH ROW
        EXECUTE FUNCTION supabase_functions.http_request(
          'https://najyegewtbeyigppuufy.supabase.co/functions/v1/send-push',
          'POST',
          '{"Content-type":"application/json","Authorization":"Bearer sb_publishable_pDw3N9foURXtQxbiTXt2aQ_Ylwziwcs"}',
          '{}',
          '5000'
        )
    $trigger$;
    RAISE NOTICE 'send_push_on_notification trigger created/refreshed.';
  ELSE
    RAISE NOTICE 'supabase_functions schema not found — this project''s webhook must be created via Dashboard > Database > Webhooks instead. See the comment block above for the exact fields.';
  END IF;
END $$;
