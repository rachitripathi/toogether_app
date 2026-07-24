import { create } from "zustand";

type User = {
  id: string;
  name: string;
  city: string;
};

type AuthStore = {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: {
    id: "dev-user-1234", // DEV mock — replace with real auth later
    name: "Test User",
    city: "Guwahati",
  },
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
