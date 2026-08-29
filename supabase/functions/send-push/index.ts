// Sends a push notification for a newly-inserted `notifications` row.
//
// Invoked by a Database Webhook (migrations/010_push_notifications_webhook.sql) on every
// INSERT into public.notifications. Looks up the recipient's push_tokens and relays through
// Expo's hosted push service (https://exp.host/--/api/v2/push/send) — Expo's own documented
// endpoint, not a custom protocol. One call covers both FCM v1 (Android) and APNs (iOS); a
// platform with no push credentials configured in EAS yet (e.g. iOS without an Apple
// Developer account) will simply have no tokens to send to, since expo-notifications never
// produces a token for that platform until the credential exists.
//
// Deploy: supabase functions deploy send-push
// No custom secrets needed — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are auto-injected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type WebhookPayload = {
  type: "INSERT";
  table: "notifications";
  record: {
    id: string;
    user_id: string;
    title: string;
    body: string;
    data: Record<string, unknown> | null;
  };
};

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    const notification = payload.record;
    if (!notification?.user_id) {
      return new Response("ignored", { status: 200 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokens, error } = await supabaseAdmin
      .from("push_tokens")
      .select("token")
      .eq("user_id", notification.user_id);

    if (error || !tokens || tokens.length === 0) {
      return new Response("no push tokens", { status: 200 });
    }

    const messages = tokens.map((row) => ({
      to: row.token,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
    }));

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    const result = await pushResponse.json();
    const tickets: Array<{ status: string; details?: { error?: string } }> = result?.data ?? [];

    // Expo's documented way to detect an uninstalled app / revoked token — self-clean
    // push_tokens instead of retrying a token that will never succeed again.
    const staleTokens = tickets
      .map((ticket, i) => (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? messages[i].to : null))
      .filter((token): token is string => token !== null);

    if (staleTokens.length > 0) {
      await supabaseAdmin.from("push_tokens").delete().in("token", staleTokens);
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("send-push error:", error);
    // 200, not 500 — this runs off a fire-and-forget DB webhook; there's no caller to retry
    // it, so surfacing an error status would just get logged as a webhook failure for
    // nothing.
    return new Response("error", { status: 200 });
  }
});
