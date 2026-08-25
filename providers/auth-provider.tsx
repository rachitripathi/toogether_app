import type { Profile } from "@/hooks/use-auth-context";
import { AuthContext } from "@/hooks/use-auth-context";
import { getStoredSessionClaims, supabase } from "@/utils/supabase";
import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { PropsWithChildren, useEffect, useRef, useState } from "react";

// Set by AppProvider's logout() right before calling supabase.auth.signOut(),
// so the onAuthStateChange handler below can tell a real sign-out apart from
// the SDK's own known wipe-on-failed-refresh bug (see utils/supabase.ts),
// which also fires a SIGNED_OUT event but should NOT log the user out here.
let explicitSignOutInProgress = false;
export function markExplicitSignOut() {
  explicitSignOutInProgress = true;
}

const getEmailName = (email: string | null) => email?.split("@")[0] ?? "New user";
const getDefaultUsername = (email: string | null, userId: string) =>
  `${getEmailName(email).toLowerCase()}-${userId.slice(0, 8)}`;

const AVATAR_COLOR_PALETTE = [
  ["#8B5CF6", "#6366F1"],
  ["#F472B6", "#FB7185"],
  ["#38BDF8", "#0EA5E9"],
  ["#34D399", "#14B8A6"],
  ["#FB923C", "#F59E0B"],
];
const getDefaultAvatarColors = () =>
  AVATAR_COLOR_PALETTE[Math.floor(Math.random() * AVATAR_COLOR_PALETTE.length)];

export default function AuthProvider({ children }: PropsWithChildren) {
  const [claims, setClaims] = useState<
    Record<string, any> | undefined | null
  >();
  const [profile, setProfile] = useState<Profile | null>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Bumped on every fetchProfile call so a slower, older request can tell it's
  // been superseded and skip applying its (now stale) result — otherwise two
  // calls racing (e.g. a session refresh landing mid-login) can resolve out of
  // order and let the older one overwrite the newer profile/isLoading state.
  const fetchRequestIdRef = useRef(0);
  // The retry backoff below can leave a fetchProfile call sleeping in a
  // setTimeout for up to ~5s; without this, a state update landing after the
  // provider itself has unmounted throws React's "state update on an
  // unmounted component" warning.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  // isLoading exists to gate the app's one-time startup splash (AppProvider's
  // isAppReady), not to reflect every profile fetch. claims gets a brand-new
  // object on every onAuthStateChange event — including a routine background
  // TOKEN_REFRESHED that autoRefreshToken fires periodically for the SAME
  // still-logged-in user — which re-triggers the [claims] effect below and
  // re-ran fetchProfile from scratch. Setting isLoading back to true on that
  // flipped isAppReady back to false well after startup, which visibly reset
  // the app back to the splash screen during completely normal, idle use —
  // nothing to do with Expo Go or the OS. Once the very first resolution has
  // happened, later fetches must update profile/claims quietly in the
  // background without ever touching isLoading again.
  const hasLoadedOnceRef = useRef(false);

  const fetchProfile = async (userClaims = claims, attempt = 0) => {
    const requestId = attempt === 0 ? ++fetchRequestIdRef.current : fetchRequestIdRef.current;
    if (attempt === 0 && !hasLoadedOnceRef.current) setIsLoading(true);

    if (!userClaims) {
      if (requestId === fetchRequestIdRef.current && isMountedRef.current) {
        setProfile(null);
        setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
      return;
    }

    // Default to whatever profile we already had. A confirmed "no such row"
    // (PGRST116) below overwrites this with null (then a freshly created
    // row); any other error — most commonly a transient cold-start network
    // failure, the same race verifyClaims() guards against for the session
    // itself — must NOT null this out, or a valid, still-logged-in session
    // gets treated as logged out just because this one fetch hiccupped.
    let nextProfile: Profile | null = profile ?? null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userClaims.sub)
      .single();

    if (error && error.code === "PGRST116") {
      const email =
        typeof userClaims.email === "string" ? userClaims.email : null;
      const { data: createdProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: userClaims.sub,
          email,
          name: getEmailName(email),
          username: getDefaultUsername(email, userClaims.sub),
          city: "",
          avatar_colors: getDefaultAvatarColors(),
        })
        .select("*")
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
      } else {
        nextProfile = createdProfile;
      }
    } else if (error) {
      // Transient failure (cold-start network not reassociated yet, timeout,
      // etc.) on the very first fetch for this session, with no prior profile
      // to fall back on — settling on null here would read as "logged out"
      // even though the session is fine. Retry with backoff instead, same as
      // verifyClaims() does for the session check itself.
      if (!profile && attempt < 2 && isMountedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 2000 : 5000));
        return fetchProfile(userClaims, attempt + 1);
      }
      console.error("Error fetching profile:", error);
    } else {
      nextProfile = data;
    }

    if (requestId !== fetchRequestIdRef.current || !isMountedRef.current) {
      return;
    }
    setProfile(nextProfile);
    setIsLoading(false);
    hasLoadedOnceRef.current = true;
  };

  useEffect(() => {
    let cancelled = false;

    // Verifies/refreshes the session against the server in the background.
    // Only a confirmed server-side rejection (isAuthApiError /
    // isAuthSessionMissingError) is treated as "actually logged out" — a
    // network/timeout failure (AuthRetryableFetchError) or any other
    // inconclusive error just gets retried with backoff, leaving whatever
    // claims we already have (from local storage or a prior check) in place.
    const verifyClaims = async (attempt = 0): Promise<void> => {
      const { data, error } = await supabase.auth.getClaims();
      if (!error) {
        if (!cancelled) setClaims(data?.claims ?? null);
        return;
      }

      if (isAuthApiError(error) || isAuthSessionMissingError(error)) {
        if (!cancelled) setClaims(null);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError) {
        const session = sessionData.session;
        if (!cancelled) {
          setClaims(session?.user ? { sub: session.user.id, email: session.user.email } : null);
        }
        return;
      }

      if (isAuthApiError(sessionError) || isAuthSessionMissingError(sessionError)) {
        if (!cancelled) setClaims(null);
        return;
      }

      // Still inconclusive (e.g. device hasn't reassociated with the network
      // yet after a cold start) — back off and try again a couple more times
      // rather than giving up and bouncing the user to the login screen.
      if (attempt < 2 && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 2000 : 5000));
        if (!cancelled) {
          await verifyClaims(attempt + 1);
        }
      }
    };

    const bootstrap = async () => {
      // Fast path: decode whatever session is already on disk and render the
      // app as logged-in immediately. This never touches the network, so it
      // can't be blocked by a cold-start network race — unlike the previous
      // implementation, which waited on getClaims()/getSession() and treated
      // a slow/failed network check as "logged out" even with a perfectly
      // valid session sitting in storage.
      const storedClaims = await getStoredSessionClaims();
      if (cancelled) return;
      if (storedClaims) {
        // Deliberately NOT clearing isLoading here. Setting claims triggers
        // the [claims] effect below, which fetches the profile and clears
        // isLoading itself once that resolves. Clearing it here instead —
        // before a profile exists — was the cold-start race that bounced an
        // already-logged-in user to /auth: AppProvider's isAppReady only
        // checks this isLoading flag, but currentUser is derived from
        // profile, so there was a one-frame window where isLoading was false
        // and profile was still null, which index.tsx read as "ready, and
        // logged out."
        setClaims(storedClaims);
      } else {
        setClaims(null);
        setIsLoading(false);
      }

      // Verify/refresh with the server in the background regardless, so a
      // genuinely logged-out device (no local session) still resolves, and a
      // logged-in one picks up a freshly refreshed token for API calls.
      await verifyClaims();
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && !explicitSignOutInProgress) {
        // Could be a real sign-out, or the SDK's own wipe-on-failed-refresh
        // bug (see utils/supabase.ts) misfiring the same event. Re-verify
        // with the server instead of trusting this blindly.
        verifyClaims();
        return;
      }
      explicitSignOutInProgress = false;
      setClaims(session?.user ? { sub: session.user.id, email: session.user.email } : null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // claims starts as undefined ("not determined yet") and only becomes an
    // object or null once bootstrap()/verifyClaims() actually resolve.
    // Fetching with it still undefined would hit fetchProfile's early-return
    // path and clear isLoading immediately — before the real session lookup
    // (an async storage read) has had a chance to finish.
    if (claims === undefined) return;
    fetchProfile();
  }, [claims]);

  return (
    <AuthContext.Provider
      value={{
        claims,
        isLoading,
        profile,
        isLoggedIn: claims != undefined,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
