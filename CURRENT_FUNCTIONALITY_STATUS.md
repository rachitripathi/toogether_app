# Current Functionality & Flow Status

**Purpose:** snapshot of what's actually wired to Supabase today vs. what's still mock/local state, taken before pulling in a branch with new UI. Use this to decide what's safe to cherry-pick (pure presentation/styling) vs. what needs care (files where JSX and data-fetching are mixed together) so a UI-only merge doesn't silently break a working DB flow or resurrect a dead mock path.

**Snapshot date:** 2026-07-25, branch `main` @ `dbe84cd`.

---

## 1. Architecture in one picture

```
route file (app/**)
   │
   ├─ useApp() ─────────► providers/AppProvider.tsx ─────► supabase (partial — see table)
   │                          seeded from lib/mockData.ts (MOCK_EVENTS, MOCK_REQUESTS, MOCK_MESSAGES, MOCK_RATINGS)
   │
   └─ useFeed()/useEvent()/useCreateEvent() ─► hooks/useEvents.ts ─► supabase (real, via React Query)

providers/auth-provider.tsx ─► supabase.auth + `profiles` table (fully real, source of truth for currentUser)
```

Two parallel data paths exist for events: **AppProvider's local `events` state** (mock-seeded, mutated optimistically) and **`useFeed()`'s React Query cache** (real `events` table). Screens that use both (home, profile) prefer the Supabase result and fall back to the mock array only while loading. This dual-path setup is the main thing to watch when merging new UI — don't let a new screen read only from `useApp().events` and think it's live data.

---

## 2. Screen-by-screen status

| Screen | Status | Tables touched | Caveats |
|---|---|---|---|
| `app/index.tsx` | Indirect | — | Pure routing gate on `isOnboardingComplete` / `currentUser` |
| `app/onboarding.tsx` | ❌ Not integrated | — | `completeOnboarding()` only sets in-memory state — **not persisted**, replays every cold start |
| `app/auth.tsx` | 🟡 Partial | `auth` | Email/password real (`signInWithPassword`/`signUp`). Google/Apple buttons call a stub (`socialAuth`) and are rendered disabled |
| `app/reset-password.tsx` | ✅ Full | `auth` only | Complete Supabase Auth flow (exchange code, set session, update password) |
| `app/verification.tsx` | 🟡 Read-only | `profiles` (via currentUser) | No real verification flow exists yet; button just navigates to profile |
| `app/(tabs)/_layout.tsx` | Indirect | — | Tab badge count reads mock `requests`, not live data |
| `app/(tabs)/home.tsx` | 🟡 Partial | `events` (select) | Real read via `useFeed()`; falls back to `MOCK_EVENTS` while loading. Has a stale comment referencing a `home.old.tsx` that no longer exists |
| `app/(tabs)/people.tsx` | ❌ Not integrated | — | `getCrewMembers()` / `getInteractedUsers()` are hardcoded to return `[]` (`// TODO: fetch real users from Supabase`) — screen is always empty |
| `app/(tabs)/activity.tsx` | ❌ Not integrated | — | Built entirely from mock `requests` + local-only `crewRequests` |
| `app/(tabs)/profile.tsx` | 🟡 Partial | `events` (select) | "Hosting"/"Past" plans real; "Joined" plans hardcoded to `[]`; karma/crew counters read stubbed functions. Has a stray `console.log(currentUser)` |
| `app/edit-profile.tsx` | ✅ Full | `profiles` (update) | Real read + write via `updateProfile()` |
| `app/create-event.tsx` | ✅ Full | `events` (insert) | Optimistic local update with rollback on Supabase failure |
| `app/event/[id].tsx` | 🟡 Partial | `events` (select), `join_requests` (insert/update) | Join/approve/reject are real writes. Creator/attendee profile lookups (`getUserById`) only resolve for the logged-in user — other people's names/avatars won't show |
| `app/chat/[id].tsx` | ❌ Not integrated | — | Messages are local-only React state (seeded from `MOCK_MESSAGES`); no `messages` table writes, no realtime subscription — nothing persists or syncs across devices |
| `app/user/[id].tsx` | ❌ Not integrated | `join_requests` (only via invite) | `getUserById` stub means this screen **renders blank for any profile that isn't your own** — it's the main nav target from People, Event detail, Chat, and Activity |

**Legend:** ✅ fully DB-backed · 🟡 mixed (some real writes/reads, some stubbed/mock) · ❌ local state or mock data only, no persistence

---

## 3. The core logic hub: `providers/AppProvider.tsx`

This file owns almost all app state and is the one place most new UI will need to plug into. Breakdown of what's real vs. stub:

**Real Supabase calls:**
- `login`, `signup`, `logout` → `supabase.auth.*`
- `signup` also inserts into `profiles`
- `updateProfile` → `profiles` update
- `createEvent` → `events` insert (optimistic + rollback)
- `requestToJoin`, `approveRequest`, `rejectRequest`, `inviteToEvent` → `join_requests` insert/update (optimistic + rollback)

**Stubbed / TODO (return empty or log only, no DB call):**
- `getCrewMembers()` → returns `[]`
- `getInteractedUsers()` → returns `[]`
- `getUserById(id)` → only resolves `currentUser`, otherwise `null`
- `socialAuth()` → `console.log` only
- `sendCrewRequest` / `acceptCrewRequest` / `rejectCrewRequest` → local state only, never written to a `crew_requests` table despite one existing in the schema
- `sendMessage` → local state only, never written to `messages`
- `rateUser` → local state only, never written to `ratings`

**Not persisted at all (resets every app restart):**
- `isOnboardingComplete`
- `shouldShowVerificationPrompt`

---

## 4. Dead / orphaned files — don't reintroduce or wire new UI to these

- `store/authStore.ts` — Zustand store with a hardcoded dev user (`dev-user-1234`). Not imported anywhere. Leftover from an earlier mock phase.
- `store/feedStore.ts` — empty file, unused.
- `hooks/useProfile.ts` — empty file, unused (profile fetching actually lives in `providers/auth-provider.tsx`).
- `hooks/useFeed.ts` — near-duplicate of half of `hooks/useEvents.ts`. The app imports `useFeed` from `@/hooks/useEvents`, not from this file — this one looks orphaned.
- `hooks/useEvents.ts`'s `useJoinRequest()` — uses `supabase.rpc(...)` nested inside `.update()`, which doesn't do what it looks like it does, and isn't called from any screen anyway (join requests actually go through `AppProvider.requestToJoin`). Likely broken and unused — don't build on it.
- `components/hello-wave.tsx`, `components/parallax-scroll-view.tsx` — look like unused leftovers from the default Expo Router template; not imported by any current route.

---

## 5. Known correctness bugs worth knowing about before merging

- `app/edit-profile.tsx`'s back-fallback does `router.replace("/profile")`, but the actual tab route is `/(tabs)/profile` — this fallback likely no-ops if `router.canGoBack()` is false.
- `app/(tabs)/home.tsx` references an archived `home.old.tsx` in a comment; that file doesn't exist in the repo.

---

## 6. Guidance for cherry-picking the incoming UI branch

1. **Safe to pull as-is:** anything purely presentational in `components/` (styling, layout, animations) as long as the new version still accepts the same props shape. These files don't call Supabase themselves — the DB/mock split lives in the route files and `AppProvider`, not here.
2. **Merge carefully, don't overwrite wholesale:** route files marked 🟡 Partial or ✅ Full in the table above (`home.tsx`, `profile.tsx`, `event/[id].tsx`, `create-event.tsx`, `edit-profile.tsx`, `auth.tsx`). These mix JSX with live data wiring (`useFeed`, `useApp()` calls, mutation handlers). Diff the incoming version against these and re-apply only the visual/JSX changes, keeping the existing data-fetching calls and optimistic-update/rollback logic intact.
3. **Freely replaceable:** UI for ❌ Not integrated screens (`people.tsx`, `activity.tsx`, `chat/[id].tsx`, `user/[id].tsx`, `onboarding.tsx`) — since there's no real data flow to preserve yet, a new UI can replace these wholesale. Just note that wiring them to real data is still an open task regardless of which UI wins.
4. **Do not resurrect:** if the incoming branch touches `store/authStore.ts`, `store/feedStore.ts`, `hooks/useProfile.ts`, or `hooks/useFeed.ts`, treat that as a conflict to resolve in favor of the current real implementations (`auth-provider.tsx`, `AppProvider.tsx`, `hooks/useEvents.ts`) rather than merging both.
5. After merging, the highest-value real gaps still open are: `getUserById` for other users, `messages`/`ratings`/`crew_requests` persistence, and onboarding/verification-prompt persistence — worth keeping in mind if the new UI assumes any of these already work.
