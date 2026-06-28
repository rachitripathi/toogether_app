import { createContext, useContext } from "react";

export type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  bio: string | null;
  age: number | null;
  gender: "man" | "woman" | "other" | null;
  city: string | null;
  avatar_uri: string | null;
  avatar_colors: string[] | null;
  verified: boolean | null;
  created_at: string | null;
  updated_at?: string | null;
};

export type AuthData = {
  claims?: Record<string, any> | null;
  profile?: Profile | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthData>({
  claims: undefined,
  profile: undefined,
  isLoading: true,
  isLoggedIn: false,
  refreshProfile: async () => {},
});

export const useAuthContext = () => useContext(AuthContext);
