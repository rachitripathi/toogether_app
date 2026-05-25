import { createContext, useContext } from "react";

export type Profile = {
  id: string;
  email: string;
  username: string;
  name: string;
  bio: string | null;
  age: number | null;
  gender: "man" | "woman" | "other";
  city: string;
  avatar_uri: string | null;
  avatar_colors: string[];
  verified: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthData = {
  claims?: Record<string, any> | null;
  profile?: Profile | null;
  isLoading: boolean;
  isLoggedIn: boolean;
};

export const AuthContext = createContext<AuthData>({
  claims: undefined,
  profile: undefined,
  isLoading: true,
  isLoggedIn: false,
});

export const useAuthContext = () => useContext(AuthContext);
