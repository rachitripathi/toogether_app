# Toogether — Functionality Documentation

**This is the canonical, living reference for what the app actually does.** Update it in the same change as any feature work — new screen, changed flow, gate added/removed. If this doc and the code disagree, the code wins; fix the doc.

Its companion doc is [`DATABASE.md`](./DATABASE.md) (schema/RLS/migrations, not feature behavior). Together these two are the only living docs for this project — old topic docs have been retired, see the note at the bottom.

> This doc distinguishes **real** (backed by Supabase, verified in the current code) from **local-only / mock** (React state that resets on logout, never persisted) wherever it matters — that distinction has bitten this project before (see the retired `CURRENT_FUNCTIONALITY_STATUS.md`, which went stale within two weeks because it didn't separate the two clearly and wasn't kept current).

---

## 0. Product concept

Toogether is a spontaneous social planning app: discover nearby real-world plans, request to join safely, meet people through shared activities, and turn good interactions into a trusted crew. Three core loops: **discover** (browse the feed), **join/host** (request to join or create a plan), **build trust** (ratings, crew connections, verification).

Safety/trust model by design: a plan's locality + time-of-day are public, but its exact address/time is only revealed to approved joiners (app-level, not RLS-enforced — see `DATABASE.md` §3.2); hosts approve who joins; women-only plans are filterable; verification (§7) and crew/ratings (§4 — currently mock, not real) are meant to build a reputation layer over time. Eight plan categories: movies, chill, music, sports, food, travel, gaming, other.

---

## 1. Stack

| Layer | Tech |
|---|---|
| App | React Native + Expo (`expo-router`, file-based routes under `app/`) |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) — see `DATABASE.md` |
| App state | React Context: `providers/AppProvider.tsx` (events/requests/messages/crew/ratings/verification) + `providers/auth-provider.tsx` (session/profile) + `providers/NotificationsProvider.tsx` (in-app notification feed, §9) |
| Local-only state | Zustand: `store/verificationDraftStore.ts` (§7), `store/locationPickerStore.ts` (below) |
| Images | Cloudinary, unsigned client uploads — see `DATABASE.md` §7 |
| Web admin panel | Does not exist yet — greenfield, see §8 |

**Dead code, confirmed not imported by anything** (leave alone unless doing a dedicated cleanup — flagging here so nobody mistakes them for the real data path): `hooks/useProfile.ts` (React-Query-based, never wired up), `store/authStore.ts` (hardcoded dev user), `store/feedStore.ts` (empty file). All real data flows through the two providers above, using plain `await supabase.from(...)` calls — no React Query in the live app despite `providers/QueryProvider.tsx` existing. (`hooks/useEvents.ts` and `hooks/useFeed.ts`, the other two React-Query files that used to sit here, were deleted 2026-08-22 — same problem plus a live bug in `useJoinRequest`'s `.update()` call.)

---

## 2. Screen map (`app/`)

**Entry / auth / onboarding**
- `app/index.tsx` — routing gate: waits for app-ready, redirects to `/onboarding`, `/auth`, or `/(tabs)/home`.
- `app/onboarding.tsx` — 3-slide intro, marks `onboarding_complete` in AsyncStorage. Follows app theme (fixed 2026-08-26 — it was hardcoded light-only, on the reasoning that the slide SVGs bake in their own light backgrounds and dark chrome around light art would look broken; that's still true of the illustration itself, which stays a fixed white "framed card" with rounded bottom corners in dark mode, but the surrounding hero gradient, title/subtitle, and pagination dots now follow `useTheme()` like every other screen). The Skip button intentionally keeps its fixed light-on-light styling in both themes — it's pinned over the illustration area, not the themed chrome below it.
- `app/auth.tsx` — login/signup (real, email/password). Google/Apple buttons are stubs. Also hosts the dev-only app-mode switcher (§6).
- `app/reset-password.tsx` — forgot-password flow: email → 6-digit OTP (emailed via Brevo) → new password. Calls `EXPO_PUBLIC_FORGOT_PASSWORD_API_URL`'s `/api/forgot-password/send-otp` and `/verify-otp`, two Route Handlers in the separate `together-admin` project — not Supabase Auth's built-in magic-link reset. See `DATABASE.md` §3.9/§6.
- `app/new-user-profile.tsx` — post-signup profile completion (name, DOB/age 18+, gender, city, bio, avatar).
- `app/new-user-verification.tsx` — post-profile upsell: "Get verified" → `/verification/capture-aadhaar`, or "Skip for now."

**Tabs** (`app/(tabs)/_layout.tsx`, custom floating tab bar; the Activity tab shows a dot when `NotificationsProvider`'s `unreadCount` is nonzero, §9)
- `home.tsx` — discovery feed: search, category chips, event cards, create button.
- `people.tsx` — crew tab: crew members, incoming requests, rate-user modal.
- `activity.tsx` — real notification inbox (§9), backed by `notifications` + `NotificationsProvider`, plus a locally-computed "rate your crew" nudge section (unrelated, stays local — ratings are still mock per §4).
- `profile.tsx` — own profile, hosting/joined/past sections, settings entry.

**Event / chat**
- `app/create-event.tsx` — modal create-plan form, real Supabase insert. Its "pin exact location" row pushes `/location-picker` (see below) rather than opening an in-screen map modal.
- `app/event/[id].tsx` — event detail; public info vs. private (post-approval) info; host approve/reject; attendee-list unlock (credits).
- `app/chat/[id].tsx` — per-event chat, gated to host + approved members.

**Profile / people**
- `app/user/[id].tsx` — another user's public profile (crew request, invite-to-event, mutual plans).
- `app/profile-plans/[section].tsx` — list screen for `hosting` / `joined` / `past`.
- `app/settings.tsx` — edit avatar/name/username/city/bio, logout.

**Verification** (`app/verification/_layout.tsx`, sub-stack)
- `index.tsx` — status screen (unverified/pending/approved/rejected) + dev-only simulate-review panel.
- `capture-aadhaar.tsx` — Aadhaar front/back capture.
- `liveness.tsx` — selfie/liveness capture + dev-only skip button.
- `review.tsx` — final review, calls `submitVerification()`.

**Monetisation**
- `app/paywall.tsx` — credit-pack upsell, shown when a usage gate is hit.

**Location picking** — `app/location-picker.tsx` is a thin route file (`export { default } from '@/components/LocationPickerScreen'`) registered in `app/_layout.tsx` with `presentation: 'modal'` and pushed from `home.tsx`'s location switcher and `create-event.tsx`'s location row. The actual screen is split one level down as `components/LocationPickerScreen.native.tsx` (real `react-native-maps` `MapView`) / `components/LocationPickerScreen.tsx` (web fallback, no native map module) — the platform split has to live on a plain component, not directly on the `app/` route file, because expo-router's route discovery bundles whichever `app/` file it matches straight into the web/SSR manifest and ignores Metro's usual per-platform extension resolution; a `location-picker.native.tsx` route file pulled `react-native-maps` into the web build and broke `expo export --platform web`. This used to be a shared `components/LocationMapPicker.*` pair rendered as a same-screen `<Modal>` from both callers. On Android, opening it meant closing one `<Modal>` (e.g. `home.tsx`'s location-options sheet) and opening another in the same tap — each RN `Modal` is backed by its own native `Dialog` window, and tearing one down while standing another up in the same commit hands the incoming window a stray dismiss, so the map flashed open and closed itself immediately (fixed 2026-08-22). Routing to a real screen removes the second `Dialog` entirely. Because a route push can't hand a result back to the screen that pushed it the way a callback prop could, the picker returns its coordinate through `store/locationPickerStore.ts` instead: the opening screen calls `open(origin, { coordinate, region })` then `router.push('/location-picker')`, and reads the result back via `useFocusEffect` + `consumeResult(origin)` once it regains focus. Needs a real Google Maps Android API key to actually render tiles — see `DATABASE.md` §8.

---

## 3. Auth & onboarding

`providers/auth-provider.tsx` owns session state:
1. On mount, it first decodes whatever session is already on disk via `getStoredSessionClaims()` (`utils/supabase.ts`) — a pure local read of the persisted JWT, no network call — and renders the app as logged-in immediately if one is found. This "optimistic local-first" step exists because the naive alternative (wait for `supabase.auth.getClaims()`/`getSession()` before deciding) bounced returning users to `/auth` whenever a cold start raced a slow network (very common in a standalone/preview build; rare enough in dev to go unnoticed) — the SDK call would time out, and a timeout was being treated identically to "no session."
   - `isLoading` (exposed as `isAuthLoading`, and folded into `AppProvider`'s `isAppReady`) is only cleared once the profile fetch for those claims actually resolves — not the instant claims are known. `AppProvider.currentUser` is derived from `profile`, not `claims`, so clearing `isLoading` any earlier left a one-frame window on every cold start where `isAppReady` was `true` but `currentUser` was still `null`; `app/index.tsx` read that as "ready, and logged out" and redirected to `/auth` even though the stored session was perfectly valid (fixed 2026-08-25 — this was the "swipe app from recents, reopen, bounced to /auth" bug). `fetchProfile()` also now retries with backoff (like `verifyClaims()` below) instead of nulling the profile out on a first-fetch network hiccup with no prior profile to fall back on, and `app/auth.tsx`'s `currentUser` watcher now silently redirects home if this screen is ever reached while already logged in (previously only self-healed mid-login-attempt), as a second line of defense against any future variant of this race.
   - Separately, `fetchProfile()` used to call `setIsLoading(true)` at the start of every call, not just the first one — but `claims` gets a brand-new object reference on every `onAuthStateChange` event, including a routine background `TOKEN_REFRESHED` that `autoRefreshToken` fires periodically for the *same already-logged-in user*. Each of those re-triggered the `[claims]` effect → `fetchProfile()` → `isLoading` flipping true again, which flipped `isAppReady` back to `false` well after startup — visibly resetting the whole app back to its splash screen during completely normal, idle use, including right after toggling system theme (a plausible AppState-adjacent moment for a refresh to land). Fixed 2026-08-26 with a `hasLoadedOnceRef`: only the very first resolution of auth state is allowed to set `isLoading`; every fetch after that updates `profile`/`claims` silently in the background. This, not Expo Go or the OS, was the actual cause of the app appearing to "close and reopen" on a theme change.
2. It then verifies/refreshes with the server in the background (`getClaims()` → `getSession()` fallback, with backoff retries). Only a confirmed server-side rejection (`isAuthApiError`/`isAuthSessionMissingError`) clears the session and forces `/auth` — a network/timeout failure (`AuthRetryableFetchError`) or any other inconclusive error just retries and otherwise leaves the optimistic claims alone.
3. `onAuthStateChange`'s `SIGNED_OUT` event is treated the same way unless it followed an explicit call to `logout()` (tracked via `markExplicitSignOut()`) — an un-flagged `SIGNED_OUT` re-verifies with the server rather than being trusted outright, since supabase-js is known to fire that same event on its own failed-refresh session wipe (see the comment in `utils/supabase.ts`), not just on a real sign-out.
4. Once claims exist, `fetchProfile()` selects the `profiles` row for `id = claims.sub`.
5. **If no row exists** (`PGRST116`), it auto-creates one: default name from the email's local-part, a generated `username`, empty `city`, a random avatar color pair. This is the entire "create profile" step — there's no separate explicit insert racing it.

Session persistence itself (`utils/supabase.ts`) stores only a small random AES key in `expo-secure-store` (well under its ~2048-byte Keychain/Keystore limit) and keeps the actual session — encrypted with that key — in `AsyncStorage`, which has no practical size limit. This replaced an earlier scheme that split the session across several chunked SecureStore keys, which wasn't crash-safe: an app kill mid-write (plausible right after a fresh login) could leave an incomplete chunk set that silently read back as "no session," forcing a re-login. A one-time migration in `getItem` reassembles and re-saves any leftover chunked value from that older format.

`AppProvider.signup()`/`login()` just call `supabase.auth.signUp`/`signInWithPassword` (wrapped with a 15s timeout) — profile creation is entirely driven by the auth-state-change event above, not by the signup call itself.

`app/new-user-profile.tsx` is the real "fill in your details" step a fresh signup lands on next (the auto-created row is bare — name/city/etc. are placeholders until this screen runs). Age/DOB is validated 18+ client-side; avatar upload goes through Cloudinary.

`app/(tabs)/profile.tsx` gates on `isAppReady` before checking `currentUser` (fixed 2026-08-25) — it used to redirect straight to `/auth` on `!currentUser` with no readiness check, unlike every other `currentUser`-gated screen in the app (which just render `null` while loading). Nothing in this app persists or restores a prior navigation route across a cold start — a fresh launch always resolves through `index.tsx` first (confirmed: no `linking`/state-persistence config, no stored "last route" key) — so this specific screen shouldn't normally be the first thing mounted. But it was still a real, independent bug on its own terms: it was the only auth-gated screen that force-navigated instead of waiting, which made it a second latent path to the same "bounced to /auth while still logged in" symptom fixed in §3, reachable by anything that might mount it before auth resolves (present or future — e.g. a deep link added later).

`socialAuth()` (Google/Apple) is a `console.log` stub — not implemented.

---

## 4. Events, requests, messaging, ratings, crew — what's real vs. local-only

All of this lives in `providers/AppProvider.tsx`.

### Real (backed by Supabase)

- **Create** (`createEvent`): checks the create-limit gate (§5), inserts into `events`, optimistic local update. Throws `'Plan creation limit reached'` if gated — caught by `create-event.tsx`, which routes to `/paywall`. The date picker (`create-event.tsx`) caps how far out an event can be scheduled at 2 years (`maximumDate`, both the Android `DateTimePickerAndroid` and iOS inline `DateTimePicker`).
- **Feed/browse**: on login, fetches all `events` + `join_requests`, hydrates each event's `approvedUserIds`/`requestUserIds` client-side. Plain `useEffect`/`useState`, no pagination, no React Query. Which `events` rows come back is governed by RLS, not a client-side filter — see the soft-delete/retention note below.
- **Join request** (`requestToJoin`): blocks women-only events for non-women, full events, and events whose `dateTime` has already passed ("This plan has already happened.") — mirrored server-side by the `join_requests_insert_own` RLS check (`DATABASE.md` §3.3). Also checks the join-limit gate (§5), inserts into `join_requests` with a client-side double-tap guard and a `23505` unique-violation recovery path (re-syncs from DB instead of surfacing an error).
- **Delete** (`deleteEvent`, called from `app/event/[id].tsx`'s "cancel plan" flow): soft delete, not a hard `DELETE` — sets `events.deleted_at`, same optimistic local removal as before so the UI looks identical to a hard delete. The row stays in the DB, invisible to every non-admin user immediately, and admin-queryable for a retention window before a human purges it manually (no automated purge job). Same retention treatment applies to an event that simply completes (its `date_time` passing) rather than being explicitly deleted — full timing model, exact windows, and the manual purge query are in `DATABASE.md` §3.2.
- **Approve/reject** (`approveRequest`/`rejectRequest`): updates `join_requests.status` + local event state.
- **Invite** (`inviteToEvent`): inserts a `join_requests` row, auto-approved if the inviter is the event's creator.
- **Chat** (`sendMessage`, `refreshEventMessages`): inserts into `messages`; a global Supabase Realtime channel (`messages-realtime`, `postgres_changes` INSERT) pushes new messages into local state live for anyone subscribed; `refreshEventMessages` re-fetches a specific event's messages when its chat screen opens (access can change after the login-time snapshot).

### Local-only / mock (React state, resets on logout — despite real tables existing for these in the DB, see `DATABASE.md` §3.5)

- **Ratings** (`rateUser`, `getUserAverageRating`, `getMyRatingForUser`): plain `useState`, seeded from `MOCK_RATINGS` in `lib/mockData.ts`. **Never written to the `ratings` table.**
- **Crew/connections** (`sendCrewRequest`, `acceptCrewRequest`, `rejectCrewRequest`, `getCrewStatus`, `getCrewMembers`): `crewRequests` is a `useState` array seeded with two hardcoded mock entries. All mutations operate on this in-memory array only. **Never written to the `crew_requests` table.** (`getCrewMembers`/`getInteractedUsers` do compute from real `profiles` data layered on top of this fake request list, so they're not literally hardcoded to `[]` — but the underlying connection state itself is fake.)

If you're building anything that assumes ratings or crew connections persist across sessions or are visible to a backend/admin tool, they currently don't — this would need real Supabase-backed implementations first.

---

## 5. Credits / monetisation

`lib/monetisation.ts` + gating calls inside `providers/AppProvider.tsx`. Entirely client-side — no payment provider integration.

- `FREE_JOIN_LIMIT = 5` free join requests/month; `VERIFIED_JOIN_BONUS = 5` extra for `verified` users; `FREE_CREATE_LIMIT = 3` free event creations/month.
- Three credit packs: Starter (₹19 / 3 credits), Regular (₹49 / 10), Power (₹99 / 25). `buyCreditPack()` grants credits **instantly on tap** — no real payment happens.
- Gates: join-request limit, event-creation limit, attendee-list unlock (costs a credit to view an event's full attendee list).
- `usageState` is plain React state — wiped on logout/reinstall. **No monthly reset logic** despite the "ThisMonth" naming in field names. **No server-side enforcement** — RLS only checks row ownership, never usage counts, so nothing stops a determined client from bypassing these limits.
- Dev-only app-mode switcher (`devAppMode`: `free`/`paid`/`limit-hit`/`new-user`) lets testers preview each gated state — see §6.

Treat this whole system as a **UI-level preview of the monetisation model**, not production billing. A real launch needs a payment provider (Razorpay/Stripe), server-side credit balance + usage tracking (a `credits`/`usage` table with RLS, or an Edge Function), and monthly-reset logic that isn't just naming.

---

## 6. Dev tools

`lib/devTools.ts` — single switch `DEV_TOOLS_ENABLED`, resolved from `EXPO_PUBLIC_DEV_TOOLS_ENABLED` or `__DEV__`. Confirmed current gates behind it:

- `app/auth.tsx` — "choose app version" switcher for `free`/`paid`/`limit-hit`/`new-user` monetisation states.
- `app/verification/index.tsx` — "simulate a review outcome" approve/reject panel, calling `setVerificationStatusDev()` (self-only, see §7 — **not** the real admin path).

None of these are reachable in a production build unless `EXPO_PUBLIC_DEV_TOOLS_ENABLED` is explicitly set.

---

## 7. Profile verification

Full route group `app/verification/` (`index`, `capture-aadhaar`, `liveness`, `review`, under `_layout.tsx`), preceded by the onboarding upsell `app/new-user-verification.tsx`.

**Flow**: capture Aadhaar front/back (`capture-aadhaar.tsx`) → selfie (`liveness.tsx`) → review & submit (`review.tsx`). All three captures use the same shared `components/verification/PhotoCaptureScreen.tsx` (a plain "Take Photo" button → `expo-image-picker`'s `launchCameraAsync` → preview/retake/confirm), parameterized by step copy and front/back camera. Captured photos live in `store/verificationDraftStore.ts` (local-only, cleared on submit/exit) until submit.

**No automated liveness/anti-spoofing check**: earlier versions of `liveness.tsx` did real-time frame-by-frame face tracking (`react-native-vision-camera` + `react-native-vision-camera-face-detector`, guided center/blink/turn-left/turn-right steps) to prove a live person was present, not a photo of a photo. That was dropped (2026-08-16) in favor of a single plain selfie capture via `expo-image-picker`, after the vision-camera dependency repeatedly caused native build/crash problems (Nitro Fabric flag breaking `react-native-maps`, MLKit's minSdk 26 requirement, etc. — see memory `camera_crash_android_rawpropsjsivalue` for the full history). Current selfie step has no more anti-spoofing property than the Aadhaar photo steps — it's just a camera-captured image. If liveness/anti-spoofing is needed again later, it needs to be reintroduced deliberately (e.g. a hosted liveness-check API) rather than a bespoke on-device frame processor.

**Submit** (`providers/AppProvider.tsx`, `submitVerification`): uploads the 3 photos to Cloudinary, then does two writes — an upsert into `verification_documents` (owner-only RLS) and an update of `profiles.verification_status='pending'` (see `DATABASE.md` §3.1, §3.6).

**Review/decide** — two paths:
- **Real admin path**: `review_verification(target_user_id, decision, rejection_reason)` RPC (`DATABASE.md` §4) — gated by `is_admin()`, snapshots the decision into `verification_reviews`, keeps `verified` in sync with `verification_status`. Call via `supabase.rpc('review_verification', {...})` using the admin's own logged-in session — no service-role key needed.
- **Dev-only self-test path**: `setVerificationStatusDev()` in `AppProvider.tsx`, gated behind `DEV_TOOLS_ENABLED`, lets a user flip their **own** status for local testing. Not usable as real moderation (RLS blocks touching another user's row outside the RPC).

**Live notification on decision (fixed 2026-08-27)**: `review_verification()` now calls `create_notification()` (`DATABASE.md` §4) as part of the same transaction that updates `profiles.verification_status`, so an approve/reject shows up in the user's Activity tab (§9) live via the `notifications` Realtime subscription — no more waiting on the next `refreshProfile()`. Out-of-app push for this (and other) notification types is not built yet — see §9's "not yet built" note.

**Known inconsistency**: `app/new-user-verification.tsx`'s "Get verified" path and the legacy quick-toggle it originally offered both ultimately funnel into the same `capture-aadhaar` flow today — but be aware a user could historically end up `verified=true` with `verification_status` still `unverified` if that screen's old direct-toggle behavior is ever reintroduced. Worth a quick look before trusting `verified` and `verification_status` to always agree.

**Still open, needs work outside this repo**: Cloudinary documents are still unsigned/public delivery (`DATABASE.md` §7) — needs a dashboard change + signed-URL endpoint. No data-retention/deletion policy for the raw ID photos (relevant given India's DPDP Act expectations around sensitive personal data minimization) — no delete path exists for `verification_documents` today (only `delete-avatar` exists, and only for avatars).

---

## 8. Building the web admin panel (for profile verification review)

No admin/web code exists anywhere in the repo yet — this is a from-scratch build. Everything it needs is already in place on the backend (`DATABASE.md` §3.6–§4):

1. **Architecture**: a Next.js (or similar) web app, Supabase Auth login (same project), no special admin login flow — "admin-ness" is just `admin_users` membership, checked server-side by RLS and by `review_verification()` itself.
2. **Bootstrap the first admin**: manual `insert into admin_users (user_id) values ('<id>')` via the Supabase SQL editor. No self-service path exists by design.
3. **Gate the UI**: call `supabase.rpc('is_admin')` after login; redirect non-admins. This is a UX nicety only — real enforcement is server-side.
4. **Screens**:
   - **Pending queue**: `select p.*, vd.* from profiles p join verification_documents vd on vd.user_id = p.id where p.verification_status = 'pending' order by p.verification_submitted_at asc` — works via the admin's own session since `verification_documents_select_own_or_admin` grants admins read access to all rows.
   - **Review detail**: render the 3 document URLs as `<img>` (still public Cloudinary URLs — the §7 caveat still applies even with DB access locked down), plus profile fields for cross-checking. Approve/Reject buttons call `review_verification()`.
   - **History** (optional): `select * from verification_reviews order by reviewed_at desc` joined to `profiles`, for "who approved this and when."
5. **The admin panel never needs the Supabase service-role key.** Keep it that way. If a future admin feature genuinely needs to bypass RLS for something `is_admin()` + a `SECURITY DEFINER` RPC can't express, follow the `delete-avatar` Edge Function template (`DATABASE.md` §6) instead of shipping the service-role key to a browser.

---

## 9. Notifications

**Real, Supabase-backed** — added 2026-08-27, replacing what used to be a client-computed, non-persistent "activity" list. Schema/RLS/triggers are `DATABASE.md` §3.10–§3.11, §4, §5; this section covers the app-side behavior.

**In-app inbox (built, no native rebuild needed)**: `providers/NotificationsProvider.tsx`, mounted in `app/_layout.tsx` inside `AppProvider` (so it can read `currentUser`). On login it fetches the last 100 rows of `notifications` for the current user and opens a Realtime channel (`notifications-realtime-<userId>`, filtered `user_id=eq.<id>`, mirroring the `messages-realtime` pattern) so new rows appear live without a refetch. Exposes `notifications`, `unreadCount`, `markAsRead(id)`, `markAllAsRead()`. `app/(tabs)/activity.tsx` renders `notifications` directly (title/body are pre-rendered server-side by the trigger/function that created the row — the client doesn't reconstruct copy from `type`, just picks an icon/tone/accent color per `type` via a small local lookup table); tapping a card marks it read and, if `data.route` is set, navigates there. `app/(tabs)/_layout.tsx`'s tab-bar dot is driven by `unreadCount` instead of the old locally-computed pending-join-request count, so it now reflects every notification type, not just pending joins.

**What generates a notification today** — all server-side (Postgres triggers + `review_verification()`), never inserted directly by the client (`notifications` has no client INSERT policy — see `DATABASE.md` §3.10):
- A join request is created (`join_requests` INSERT) → the event's host, unless it's an auto-approved invite, in which case the invitee is notified directly instead.
- A join request is approved/rejected (`join_requests` UPDATE OF status) → the requester.
- A verification decision (`review_verification()` RPC) → the reviewed user.
- A new chat message (`messages` INSERT) → every other approved participant of that event (host + approved joiners, sender excluded).

Crew requests are **not** included — `crew_requests` is still mock/local-only (§4), so there's nothing real to trigger off yet; wiring that up needs the crew system to move off `MOCK_RATINGS`/in-memory state first.

**Push notifications (built 2026-08-27, Android-only until an Apple Developer account exists)**: `expo-notifications` + `expo-device`, config plugin added to `app.json`'s `plugins` (`"expo-notifications"`, no custom options — default icon/sound, no per-platform overrides). `providers/NotificationsProvider.tsx` handles registration:

- Sets the Expo-recommended default foreground notification handler (banner + sound, no custom suppression logic) at module scope.
- Creates the Android `default` notification channel on mount — a platform requirement since Android 8 (API 26), not app-specific behavior.
- On login, if running on a physical device (`expo-device`'s `Device.isDevice`), requests notification permission via the stock `Notifications.requestPermissionsAsync()` (no custom pre-permission priming screen — just the native OS prompt), then calls `Notifications.getExpoPushTokenAsync({ projectId })` and upserts the result into `push_tokens` (`DATABASE.md` §3.11). On logout or account switch, deletes that device's token row for the previous user.
- Tap handling via the stock `addNotificationResponseReceivedListener`, deep-linking through `data.route` — same convention the in-app list uses.
- **Deliberately no custom behavior beyond what each OS's notification APIs require**: no custom permission-priming UI, no per-notification-type toggle, no foreground-suppression heuristics. `app/settings.tsx` has one "Notifications" row that opens system Settings via `Linking.openSettings()` when permission was denied — the standard pattern for both platforms once a permission prompt has been dismissed (neither OS lets an app re-trigger its own native prompt after a denial).

Delivery: a Database Webhook (`migrations/010_push_notifications_webhook.sql`, trigger `send_push_on_notification`) fires on every `notifications` INSERT and calls the `send-push` Edge Function (`DATABASE.md` §6), which looks up the recipient's `push_tokens` and relays through Expo's hosted push API — one call that covers both FCM v1 (Android) and APNs (iOS).

**Why Android works today and iOS doesn't yet — and why that needs no further code**: `getExpoPushTokenAsync()` only succeeds for a platform whose push credential is configured in EAS. An APNs key requires an Apple Developer Program membership (paid), which doesn't exist for this project yet, so on iOS the call currently fails and `registerForPushNotifications()` catches it and returns quietly — no token is ever written for that platform, no crash, no visible error to the user, and the in-app inbox (§9 above) keeps working normally regardless. Once an Apple Developer account exists: run `eas credentials` to generate/upload the APNs key, ship a new iOS build via `eas build -p ios` (a native module — needs a build, not just an OTA update), and iOS devices will start registering tokens through the exact same code path Android already uses today. Nothing in this repo needs to change for that to happen.

---

## Retired docs

`SCHEMA_DOCUMENTATION.md`, `DATABASE_DOCUMENTATION_INDEX.md`, `API_REFERENCE.md`, `SETUP_GUIDE.md`, `CREDIT_SYSTEM.md`, `DEV_TOOLS.md`, `CURRENT_FUNCTIONALITY_STATUS.md`, `MIGRATION_UPDATES_MAY2026.md`, `docs/TOOGETHER_PRODUCT_OVERVIEW.md`, `docs/PROFILE_VERIFICATION_SYSTEM.md` have all been folded into this doc and `DATABASE.md`, and reduced to short pointers. From now on, update **only these two files** for schema or functionality changes — don't spin up a new topic-specific doc.
