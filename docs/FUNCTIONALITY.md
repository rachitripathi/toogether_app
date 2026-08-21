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
| App state | React Context: `providers/AppProvider.tsx` (events/requests/messages/crew/ratings/verification) + `providers/auth-provider.tsx` (session/profile) |
| Local-only state | Zustand: `store/verificationDraftStore.ts` (the only live Zustand store — see §7) |
| Images | Cloudinary, unsigned client uploads — see `DATABASE.md` §7 |
| Web admin panel | Does not exist yet — greenfield, see §8 |

**Dead code, confirmed not imported by anything** (leave alone unless doing a dedicated cleanup — flagging here so nobody mistakes them for the real data path): `hooks/useEvents.ts`, `hooks/useFeed.ts`, `hooks/useProfile.ts` (React-Query-based, never wired up), `store/authStore.ts` (hardcoded dev user), `store/feedStore.ts` (empty file). All real data flows through the two providers above, using plain `await supabase.from(...)` calls — no React Query in the live app despite `providers/QueryProvider.tsx` existing.

---

## 2. Screen map (`app/`)

**Entry / auth / onboarding**
- `app/index.tsx` — routing gate: waits for app-ready, redirects to `/onboarding`, `/auth`, or `/(tabs)/home`.
- `app/onboarding.tsx` — 3-slide intro, marks `onboarding_complete` in AsyncStorage.
- `app/auth.tsx` — login/signup (real, email/password). Google/Apple buttons are stubs. Also hosts the dev-only app-mode switcher (§6).
- `app/reset-password.tsx` — forgot-password flow: email → 6-digit OTP (emailed via Brevo) → new password. Calls `EXPO_PUBLIC_FORGOT_PASSWORD_API_URL`'s `/api/forgot-password/send-otp` and `/verify-otp`, two Route Handlers in the separate `together-admin` project — not Supabase Auth's built-in magic-link reset. See `DATABASE.md` §3.9/§6.
- `app/new-user-profile.tsx` — post-signup profile completion (name, DOB/age 18+, gender, city, bio, avatar).
- `app/new-user-verification.tsx` — post-profile upsell: "Get verified" → `/verification/capture-aadhaar`, or "Skip for now."

**Tabs** (`app/(tabs)/_layout.tsx`, custom floating tab bar with a pending-request badge)
- `home.tsx` — discovery feed: search, category chips, event cards, create button.
- `people.tsx` — crew tab: crew members, incoming requests, rate-user modal.
- `activity.tsx` — inbox built from join requests + crew requests.
- `profile.tsx` — own profile, hosting/joined/past sections, settings entry.

**Event / chat**
- `app/create-event.tsx` — modal create-plan form, real Supabase insert.
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

---

## 3. Auth & onboarding

`providers/auth-provider.tsx` owns session state:
1. On mount, calls `supabase.auth.getClaims()` (falls back to `getSession()` on error, with one retry after a 1.5s delay to survive a cold-start network blip), and subscribes to `onAuthStateChange`.
2. Once claims exist, `fetchProfile()` selects the `profiles` row for `id = claims.sub`.
3. **If no row exists** (`PGRST116`), it auto-creates one: default name from the email's local-part, a generated `username`, empty `city`, a random avatar color pair. This is the entire "create profile" step — there's no separate explicit insert racing it.

`AppProvider.signup()`/`login()` just call `supabase.auth.signUp`/`signInWithPassword` (wrapped with a 15s timeout) — profile creation is entirely driven by the auth-state-change event above, not by the signup call itself.

`app/new-user-profile.tsx` is the real "fill in your details" step a fresh signup lands on next (the auto-created row is bare — name/city/etc. are placeholders until this screen runs). Age/DOB is validated 18+ client-side; avatar upload goes through Cloudinary.

`socialAuth()` (Google/Apple) is a `console.log` stub — not implemented.

---

## 4. Events, requests, messaging, ratings, crew — what's real vs. local-only

All of this lives in `providers/AppProvider.tsx`.

### Real (backed by Supabase)

- **Create** (`createEvent`): checks the create-limit gate (§5), inserts into `events`, optimistic local update. Throws `'Plan creation limit reached'` if gated — caught by `create-event.tsx`, which routes to `/paywall`.
- **Feed/browse**: on login, fetches all `events` + `join_requests`, hydrates each event's `approvedUserIds`/`requestUserIds` client-side. Plain `useEffect`/`useState`, no pagination, no React Query.
- **Join request** (`requestToJoin`): blocks women-only events for non-women and full events, checks the join-limit gate (§5), inserts into `join_requests` with a client-side double-tap guard and a `23505` unique-violation recovery path (re-syncs from DB instead of surfacing an error).
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

**Known gap — no live notification on decision**: no push library, no realtime subscription on `profiles` (only `messages` streams — `DATABASE.md` §5), no verification entry in the activity feed (`app/(tabs)/activity.tsx`). A user only sees a status change on their next `refreshProfile()` call (app reopen, or any other profile-mutating action). Cheapest fix: call `refreshProfile()` when the `/verification` pending screen regains focus. Bigger fixes: a Realtime subscription filtered to the user's own `profiles.id`, or `expo-notifications` + device token storage + a push send from `review_verification()`.

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

## Retired docs

`SCHEMA_DOCUMENTATION.md`, `DATABASE_DOCUMENTATION_INDEX.md`, `API_REFERENCE.md`, `SETUP_GUIDE.md`, `CREDIT_SYSTEM.md`, `DEV_TOOLS.md`, `CURRENT_FUNCTIONALITY_STATUS.md`, `MIGRATION_UPDATES_MAY2026.md`, `docs/TOOGETHER_PRODUCT_OVERVIEW.md`, `docs/PROFILE_VERIFICATION_SYSTEM.md` have all been folded into this doc and `DATABASE.md`, and reduced to short pointers. From now on, update **only these two files** for schema or functionality changes — don't spin up a new topic-specific doc.
