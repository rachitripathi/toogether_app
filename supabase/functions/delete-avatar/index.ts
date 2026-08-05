// Deletes the calling user's current profile photo from Cloudinary.
//
// Cloudinary's delete (Admin API `destroy`) endpoint requires a request signed with the
// account's API secret. That secret must never ship inside the mobile app bundle, so this
// function holds it server-side (as Supabase secrets, not env vars in the repo) and is the
// only place the delete actually happens.
//
// Deliberately takes no public_id from the request body — it looks up profiles.avatar_uri
// for the user identified by their own JWT and derives the public_id from that URL, so a
// caller can only ever delete their own avatar, never anyone else's.
//
// Deploy: supabase functions deploy delete-avatar
// Secrets: supabase secrets set CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const API_KEY = Deno.env.get("CLOUDINARY_API_KEY")!;
const API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function signature(publicId: string, timestamp: number): Promise<string> {
  const data = new TextEncoder().encode(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Cloudinary delivery URLs look like:
//   https://res.cloudinary.com/<cloud>/image/upload/v169.../toogether/avatars/abc123.jpg
// The public_id is everything after the (optional) version segment, minus the extension.
function publicIdFromUrl(url: string): string | null {
  const match = /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/.exec(url);
  return match?.[1] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header" }, 401);
  }

  try {
    // Service-role client so we can read the caller's row regardless of RLS — but the only
    // identity we ever trust is the user id decoded from their own JWT below.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      return jsonResponse({ error: "Invalid session" }, 401);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("avatar_uri")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    const avatarUrl = profile?.avatar_uri as string | null;
    const publicId = avatarUrl ? publicIdFromUrl(avatarUrl) : null;
    if (!publicId) {
      return jsonResponse({ deleted: false });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const form = new FormData();
    form.append("public_id", publicId);
    form.append("api_key", API_KEY);
    form.append("timestamp", String(timestamp));
    form.append("signature", await signature(publicId, timestamp));

    const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
      method: "POST",
      body: form,
    });
    const cloudinaryResult = await cloudinaryResponse.json();

    if (!cloudinaryResponse.ok || !["ok", "not found"].includes(cloudinaryResult.result)) {
      throw new Error(cloudinaryResult?.error?.message ?? "Cloudinary delete failed");
    }

    // Clear the pointer so a retry (or the next call) never re-attempts deleting an asset
    // that's already gone.
    await supabaseAdmin.from("profiles").update({ avatar_uri: null }).eq("id", user.id);

    return jsonResponse({ deleted: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
