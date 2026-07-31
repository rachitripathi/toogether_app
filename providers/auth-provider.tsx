import type { Profile } from "@/hooks/use-auth-context";
import { AuthContext } from "@/hooks/use-auth-context";
import { supabase } from "@/utils/supabase";
import { PropsWithChildren, useEffect, useState } from "react";

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

  const fetchProfile = async (userClaims = claims) => {
    setIsLoading(true);
    if (userClaims) {
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
          setProfile(null);
        } else {
          setProfile(createdProfile);
        }
      } else if (error) {
        console.error("Error fetching profile:", error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } else {
      setProfile(null);
    }
    setIsLoading(false);
  };

  // Returns true once a definitive answer was reached (logged in or genuinely
  // logged out) and false if the attempt hit an error and should be retried —
  // e.g. a transient network hiccup right at cold-start shouldn't be treated
  // the same as an actual logged-out state.
  const loadClaims = async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.getClaims();
    if (!error) {
      setClaims(data?.claims ?? null);
      return true;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return false;
    }
    const session = sessionData.session;
    setClaims(session?.user ? { sub: session.user.id, email: session.user.email } : null);
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchClaims = async () => {
      setIsLoading(true);
      const ok = await loadClaims();
      if (!ok && !cancelled) {
        // One retry after a short delay to ride out a cold-start network blip
        // instead of immediately dropping the user back to the login screen.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (!cancelled) {
          await loadClaims();
        }
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    };
    fetchClaims();

    // Use the session handed to us by the event directly instead of calling
    // getClaims()/getSession() again here — fewer redundant calls means fewer
    // chances to trip the SDK's refresh-failure session wipe (see utils/supabase.ts).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setClaims(session?.user ? { sub: session.user.id, email: session.user.email } : null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
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
