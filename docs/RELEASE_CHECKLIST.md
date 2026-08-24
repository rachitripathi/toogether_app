# Toogether — Build, Test & Launch Checklist

This is an operational runbook, not a functionality/schema doc — it doesn't duplicate `FUNCTIONALITY.md` or `DATABASE.md`, it links to them. Check items off as you go; re-run the "every build" section every single time, it's cheap insurance.

Last verified against the repo: 2026-08-12 (commit `ca57048`).

---

## 0. One-time fixes — do these before your first real store submission

Found during a project audit. None of these block internal testing, but all of them block Apple/Google review.

- [ ] **App icons aren't square.** `assets/images/icon.png` and `assets/images/android-icon-foreground.png` are 960×929, not square. `expo-doctor` flags this and both stores will reject or badly crop it. Re-export both as square.
- [ ] **iOS `bundleIdentifier` is missing from `app.json`.** There's an `android.package` (`com.toogether.app`) but no `ios.bundleIdentifier`. Add one (e.g. `com.toogether.app`) before the first iOS build — EAS will prompt/auto-generate one otherwise, and you want to control it, not have it assigned for you.
- [ ] **Google/Apple sign-in buttons are dead.** `app/auth.tsx` shows working-looking Google and Apple buttons, but `socialAuth()` in `providers/AppProvider.tsx` is a `console.log` stub — tapping them does nothing, no error, no feedback. This reads as broken functionality to a reviewer (Apple Guideline 2.1) and is a bad first impression for real users. Before public launch: either implement real Supabase OAuth for both, or hide the buttons and ship email/password only.
- [ ] **`app/settings.tsx:49` TypeScript error** — `setCity(currentUser.city)` where `city` is optional. Doesn't block an EAS build (EAS doesn't type-check), but worth a one-line fix (`currentUser.city ?? ''`).
- [ ] **`eas-cli` is a local devDependency.** `expo-doctor` recommends global/`npx` instead — low priority, doesn't block anything.
- [ ] **Confirm `migrations/007_secure_verification_admin.sql` has been run** against your live Supabase project (SQL editor). If it hasn't, verification submissions will throw at runtime — the app already writes to the new `verification_documents` table this migration creates. See `DATABASE.md` §3.6.
- [ ] **Privacy policy page.** Both stores require a hosted privacy policy URL, and this app collects camera images (Aadhaar ID + liveness selfie) and location — sensitive categories that get extra scrutiny. Write one and host it somewhere (even a simple static page) before you fill in store listings.

---

## 1. Every build — pre-flight (repeat this every time, not just once)

```bash
git pull
npm install
npx tsc --noEmit          # should be clean (after the settings.tsx fix above)
npx expo lint              # errors are mostly react/no-unescaped-entities in verification screens — cosmetic, but check nothing new snuck in
npx expo-doctor            # should show only the known react-native-nitro-image New-Arch warning once §0 is fixed
```

If `tsc`/lint turn up something new, stop and fix it before spending build minutes — EAS builds are slow (10–20 min) and each one costs quota.

---

## 2. Phase A — free testing rollout (where you are now)

Goal: everyone who installs gets full access, no paywall, no credit limits, so testers aren't blocked by anything while you gather feedback.

- [ ] Confirm `APP_VERSION` in `lib/monetisation.ts` is `'free'` (it is, by default). This alone disables all gating — join limits, create limits, attendee-list unlock all pass through.
- [ ] Don't set `EXPO_PUBLIC_DEV_TOOLS_ENABLED=true` for tester builds. Leave it unset — release builds (`preview`/`production` EAS profiles) have `__DEV__ = false`, so the dev-only "choose app version" switcher and verification skip/simulate buttons are automatically hidden. You get a clean tester experience without extra config.
- [ ] **Android testers** — simplest path, no store needed:
  ```bash
  eas build -p android --profile preview   # produces an installable .apk
  ```
  Share the resulting `.apk` link directly (Slack/WhatsApp/Drive). Testers just need "install from unknown sources" enabled once.
- [ ] **iOS testers** — two options, pick one:
  - **TestFlight** (recommended): requires the Apple Developer account + App Store Connect app record from §3 below, but no per-device UDID registration and testers get a normal TestFlight install.
    ```bash
    eas build -p ios --profile production --submit
    ```
  - **Ad-hoc internal build**: `eas build -p ios --profile development` (or add an `internal` iOS profile), but every tester's device UDID must be registered with Apple first (`eas device:create`) — more friction, skip this unless you specifically don't want App Store Connect involved yet.
- [ ] Test matrix — walk the golden paths on at least one real Android **and** one real iOS device (not just simulator/emulator — the camera-based verification flow uses `react-native-vision-camera` + a custom native patch for New Architecture that's only been validated on Android so far):
  - Sign up → `new-user-profile` → `new-user-verification` (skip and complete-later paths)
  - Verification: capture-aadhaar (front/back) → liveness (all 4 steps) → review → submit → status screen
  - Home feed, category filters, search
  - Create event (map picker, all fields) → appears in feed
  - Join event → host approves/rejects → chat unlocks for approved members
  - Edit/delete event (as host)
  - People tab: crew requests, search, rate a user
  - Activity tab: dismiss cards, post-event rating nudges
  - Profile tab, settings edit, logout
  - Paywall screen renders correctly even though nothing gates into it yet (preview it via the dev-mode switcher on a **dev-client** build only, never in the tester build)

---

## 3. One-time store setup (needed before *any* production submission, do in parallel with Phase A)

- [ ] Apple Developer Program account ($99/yr) + App Store Connect app record (bundle ID must match `ios.bundleIdentifier` from §0).
- [ ] Google Play Console account ($25 one-time) + app record (package must match `com.toogether.app`).
- [ ] **Google Play's 14-day closed-testing requirement**: new personal Play Developer accounts must run a closed test with 12+ testers for 14 continuous days before Google grants production access. Start this early — it's a calendar-time blocker, not a work blocker. Your Phase A `preview` APK testers can double as this closed-testing group if you set up a proper Play Console closed track (not just APK sharing) for at least some of them.
- [ ] Fill in `eas.json`'s empty `submit.production` block with real credentials:
  ```json
  "submit": {
    "production": {
      "ios": { "appleId": "you@example.com", "ascAppId": "...", "appleTeamId": "..." },
      "android": { "serviceAccountKeyPath": "./google-service-account.json", "track": "internal" }
    }
  }
  ```
- [ ] Store listing assets: app icon (fixed, square), feature graphic (Android), screenshots per required device size for both stores, short + long description, support URL, privacy policy URL (§0).
- [ ] Content rating questionnaire (Play) / age rating (Apple) — flag ID-document capture and location use accurately.
- [ ] **Data safety form (Play) / App Privacy "nutrition label" (Apple)** — must accurately declare: camera (Aadhaar ID photos + liveness selfie), precise location, account info (email, name, DOB, gender). Getting this wrong is a common rejection reason and, worse, a compliance risk given the sensitive-ID-document angle.

---

## 4. Submitting a release build

```bash
# Android — production profile builds an .aab (Play Store requires this, not .apk)
eas build -p android --profile production --submit

# iOS — production profile
eas build -p ios --profile production --submit
```

Both `--submit` flags push straight to App Store Connect / Play Console using the `submit.production` config from §3. First submission to each store still requires you to manually finish the listing (screenshots, description, rating, pricing) in their respective consoles before you can send it for review.

`production` has `autoIncrement: true` in `eas.json`, so build numbers/version codes bump automatically — you don't need to hand-edit those per release.

---

## 5. Phase B — turning on the paywall & credit system (later, not now)

Read `FUNCTIONALITY.md` §5 first — as of today the whole credit/paywall system is **client-side only**: no payment provider, credits are granted instantly on tap, usage counters are plain React state that resets on logout/reinstall, and nothing on the server stops a user from bypassing any limit. There are two very different versions of "turning it on":

### 5a. Cosmetic flip (fast, but not real monetisation)
- [ ] Set `APP_VERSION = 'paid'` in `lib/monetisation.ts`.
- [ ] This re-enables the join/create/attendee-list gates and the paywall screen for everyone — but "buying" a credit pack still just grants credits instantly with no real charge and no server record. Fine for a demo or investor pitch, **not fine for real users you intend to charge**.

### 5b. Real monetisation (what you actually need before charging money)

⚠️ **Critical platform-policy point, decide this before writing any payment code:** Apple and Google both require **their own in-app purchase system** (StoreKit/IAP on iOS, Play Billing on Android) for unlocking *digital* content or features inside the app — which is exactly what credits do here (unlock attendee lists, extra joins/creates). You generally **cannot** use Razorpay/Stripe/UPI directly for this on either platform without risking rejection or account termination. The common way around building raw StoreKit + Play Billing integration twice is [RevenueCat](https://www.revenuecat.com/) or `react-native-iap` / `expo-in-app-purchases` — pick one before scoping the rest of this work, it changes the shape of the backend below.

- [ ] Choose the IAP layer (RevenueCat recommended for a two-platform app — handles receipt validation and cross-platform entitlement syncing for you).
- [ ] Define credit packs as IAP products in App Store Connect + Play Console, matching `CREDIT_PACKS` in `lib/monetisation.ts`.
- [ ] Build a real `credits`/`usage` table in Supabase with RLS (owner-read, no client-write — balance changes only via a server path), replacing the `useState`-based `usageState`. See `DATABASE.md` for the RLS + `SECURITY DEFINER` RPC pattern already used for verification review (`migrations/007_secure_verification_admin.sql` is a good template: an RPC that's the *only* way a balance can change, gated server-side).
- [ ] Handle purchase confirmation server-side (RevenueCat webhook → Supabase Edge Function that credits the account) — never trust a client-reported "purchase succeeded" event alone.
- [ ] Implement the monthly-reset logic the field names (`...ThisMonth`) already imply but don't currently do (needs a scheduled Edge Function or Postgres cron).
- [ ] Re-test the full gating matrix from Phase A's test list, this time with `APP_VERSION = 'paid'`, on both platforms, using each store's **sandbox/test purchase** mode before going live.
- [ ] Update `docs/FUNCTIONALITY.md` §5 in the same change, per this repo's documentation convention (`CLAUDE.md`) — once this is real, that section's "treat this as a UI-level preview" caveat needs to come out.

---

## 6. Post-launch

- [ ] Set up `eas build:list` / App Store Connect / Play Console review-status monitoring — first submissions commonly get one round of rejection feedback, budget time for it.
- [ ] Decide on a crash/analytics tool (nothing is wired up currently) before you have real users you can't just ask directly what broke.
- [ ] Once verification review volume justifies it, build the web admin panel described in `FUNCTIONALITY.md` §8 — right now `review_verification()` exists as a backend RPC but there's no UI to call it from.
