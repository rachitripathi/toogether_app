# Credits & Monetisation

Toogether has a freemium credit system already built into the app: free monthly limits on
joining/creating plans, a paywall that appears once you hit them, and purchasable credit
packs that lift the limit. **It is entirely client-side right now — no payment provider is
wired up, and nothing about credits is persisted to Supabase.**

## The model, in one sentence

Every user gets a free monthly allowance of join requests and plan creations; once used up,
further joins/creates cost 1 credit each, and credits are bought in packs (no subscription —
credits never expire).

## Where it lives

| Concern | File |
|---|---|
| Limits, credit pack definitions, on/off switch | `lib/monetisation.ts` |
| All the actual logic (usage tracking, spending, gating) | `providers/AppProvider.tsx` |
| The upsell screen | `app/paywall.tsx` |
| Home screen usage banner, profile screen usage stats | `app/(tabs)/home.tsx`, `app/(tabs)/profile.tsx` |
| Create-plan limit banner | `app/create-event.tsx` |
| Attendee-list unlock ("Phase 2 preview") | `app/event/[id].tsx` |

## The rules

- **Free join limit**: `FREE_JOIN_LIMIT = 5` join requests per month.
- **Verified bonus**: verified users get `VERIFIED_JOIN_BONUS = 5` extra joins on top (10 total).
- **Free create limit**: `FREE_CREATE_LIMIT = 3` plans created per month.
- Once the free limit for an action is used up, the *next* one costs **1 credit** instead of
  being blocked outright — you only actually get stopped when your free limit is exhausted
  **and** you have 0 credits.
- **Unlocking an event's attendee list** (instead of just seeing a count) also costs 1 credit,
  independent of the join/create limits — see "Attendee unlock" below.
- **Credit packs** (`CREDIT_PACKS` in `lib/monetisation.ts`), one-time purchases, no expiry:

  | Pack | Price | Credits |
  |---|---|---|
  | Starter | ₹19 | 3 |
  | Regular | ₹49 | 10 |
  | Power | ₹99 | 25 |

There is no subscription tier — it's pay-as-you-go credits on top of a free monthly
allowance, not a recurring plan.

## How the limits reset

They don't, yet. `joinRequestsThisMonth` and `plansCreatedThisMonth` are counters that only
ever go up for the lifetime of the signed-in session (see "What's NOT implemented" below) —
there's no actual month-boundary reset logic anywhere in the code despite the naming.

## The on/off switch

Monetisation is gated by `devAppMode`, one of `'free' | 'paid' | 'limit-hit' | 'new-user'`:

- `isMonetisationEnabled(mode)` → `true` only for `'paid'` and `'limit-hit'`.
- In `'free'` mode (and `'new-user'`), there are no limits, no paywall, no credit spending at
  all — everything is unlimited.
- `'limit-hit'` is a demo mode that starts a session already at the limit with 0 credits, so
  the paywall can be previewed instantly without actually using up 5 joins first.
- Which mode a real (non-dev) session defaults to is controlled by a single constant:
  `APP_VERSION: AppVersion = 'free' | 'paid'` in `lib/monetisation.ts` — flip this to `'paid'`
  to turn monetisation on for real users by default.
- The `devAppMode` switcher UI on the login screen (letting a tester flip between all four
  modes) is a **developer/demo tool**, separately gated by `DEV_TOOLS_ENABLED` — see
  [DEV_TOOLS.md](./DEV_TOOLS.md). It has nothing to do with `APP_VERSION`; hiding the dev
  switcher doesn't change what real users see, only whether testers can preview other states.

## Where the numbers actually live

`currentUser.credits`, `.joinRequestsThisMonth`, `.plansCreatedThisMonth`,
`.totalCreditsEarned`, `.totalCreditsSpent` are **not real `profiles` columns** — there's no
such thing in the Supabase schema. Instead, `AppProvider` keeps a local `usageState` object in
React state, merged on top of the real (Supabase-backed) `currentUser` object on every render:

```
currentUser = withDevUsage({ ...realProfileFromSupabase, ...usageState })
```

`withDevUsage()` fills in mode-appropriate defaults (e.g. 2 free credits to start with in
`'paid'` mode) whenever a field isn't already set in `usageState`. Any time credits/usage
actually change (buying a pack, spending a credit), `updateCurrentUserUsage()` writes into
`usageState`, which is what re-renders the numbers everywhere (paywall, profile, home banner).

**This state resets to defaults on logout/login and on every fresh app install** — it lives
only in memory for the current session, keyed to nothing persistent.

## The three gates, concretely

**Joining a plan** (`requestToJoin` in `AppProvider.tsx`):
1. `shouldShowPaywallForJoin()` — if monetisation is on and you're at your join limit with 0
   credits, the join button routes to `/paywall` instead of submitting.
2. If you have credits (or aren't at the limit), the join proceeds; `joinRequestsThisMonth`
   increments, and if you were already over the free limit, `credits` decrements by 1.

**Creating a plan** (`createEvent` in `AppProvider.tsx`, called from `create-event.tsx`):
Same shape — `shouldShowPaywallForCreate()` gates the submit button; on create, throws
`Error('Plan creation limit reached')` if monetisation is on and you're at the limit with 0
credits (caught by `create-event.tsx`, which redirects to `/paywall`).

**Unlocking an event's attendee list** (`unlockAttendees` in `AppProvider.tsx`, used by
`event/[id].tsx`): independent of the two limits above — if monetisation is on and the list
isn't already unlocked for that event, spends 1 credit immediately (no free allowance for
this one at all). If you have 0 credits, `unlockAttendees` returns `false` and the screen
routes to `/paywall`. Once unlocked for an event, it stays unlocked for the rest of the
session (`unlockedAttendeeEventIds`, also just local React state).

**Buying a pack** (`buyCreditPack` in `AppProvider.tsx`, called from `app/paywall.tsx`): adds
the pack's credit count to `usageState.credits` and `totalCreditsEarned`. There's no actual
payment step — tapping a pack in the UI just grants the credits instantly.

## What's NOT implemented (this is the important part)

- **No real payments.** Tapping a credit pack in `app/paywall.tsx` calls `buyCreditPack()`
  directly — there's no Razorpay/Stripe/UPI/App Store/Play Billing integration anywhere in the
  codebase. Anyone can "buy" unlimited credits for free right now just by tapping the pack.
- **No persistence.** None of `credits`, `joinRequestsThisMonth`, `plansCreatedThisMonth`,
  `totalCreditsEarned`, `totalCreditsSpent` are written to Supabase. Log out and back in (or
  reinstall) and a paying user's balance is gone.
- **No monthly reset job.** The "this month" counters just accumulate for the session; there's
  no cron/date-boundary logic that actually zeroes them out at the start of a new month.
- **No server-side enforcement.** All gating happens in the React Native client. A modified
  client (or a direct Supabase call bypassing the app) could join/create without limit — the
  `join_requests`/`events` insert RLS policies only check *who* you are, not whether you're
  within your free/paid allowance.

Building any of this out for real requires: a `credits`/usage table (or columns) in Supabase
with RLS that only the backend can decrement, a payment provider integration, and a
scheduled job (Supabase Edge Function + cron, or similar) for monthly resets — none of which
exist yet.
