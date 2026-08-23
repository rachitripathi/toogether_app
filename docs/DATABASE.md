# Toogether — Database Documentation

**This is the canonical, living reference for the database.** Update it in the same commit as any migration. If this doc and a migration file ever disagree, the migration files under `migrations/` are ground truth — fix this doc to match, don't trust old prose over SQL.

Its companion doc is [`FUNCTIONALITY.md`](./FUNCTIONALITY.md) (app features/flows, not schema). Together these two are the only living docs for this project — see the note at the bottom about retired docs.

---

## 1. Platform

- **Postgres + Auth + Realtime + Edge Functions**, all via **Supabase**. Project ref `najyegewtbeyigppuufy` (`.env`, `utils/supabase.ts:68`).
- No ORM (no Prisma/Drizzle) — schema is managed as **hand-run, idempotent SQL migrations** in `migrations/`, applied manually via the Supabase SQL editor or `supabase db push`. There is no local dev Supabase project checked in (no `supabase/config.toml`); migrations target production directly.
- Auth: Supabase Auth (email/password only in the live app; Google/Apple buttons in `app/auth.tsx` are UI stubs, not wired up).
- Image storage: **Cloudinary**, not Supabase Storage (see §7).

### Migration history

| File | What it did |
|---|---|
| `001_create_core_schema.sql` | Created `profiles` + baseline RLS (buggy `CREATE POLICY IF NOT EXISTS` syntax — likely partially failed on first run). |
| `002_fix_rls_policies_and_profile_columns.sql` | Fixed policy/trigger syntax, added `avatar_uri`, relaxed several `profiles` columns to nullable. |
| `003_reset_rls_and_sync_schema.sql` | Dynamically drops *every* existing policy per table (regardless of name — the live DB had hand-created policies via the dashboard that didn't match 001/002's names) and recreates one clean set. Added `profiles.updated_at`. |
| `004_create_remaining_tables.sql` | Created `events`, `join_requests`, `messages`, `ratings`, `crew_requests` + their RLS/indexes/triggers. |
| `005_enable_messages_realtime.sql` | Added `messages` to the `supabase_realtime` publication. |
| `006_add_verification_status.sql` | Added verification columns to `profiles` (status/submitted_at/rejection_reason/document URIs), backfilled `verified=true` rows to `approved`. |
| `007_secure_verification_admin.sql` | Moved document URIs off `profiles` into `verification_documents`; added `admin_users`, `is_admin()`, `verification_reviews`, `review_verification()` RPC; added a `CHECK` constraint on `verification_status`. |
| `008_password_reset_otps.sql` | Added `password_reset_otps` (RLS enabled, zero policies) backing the OTP-based forgot-password flow. |

Two now-retired docs (`MIGRATION_UPDATES_MAY2026.md`, `DATABASE_DOCUMENTATION_INDEX.md`) previously duplicated this history in prose — this table supersedes them.

---

## 2. Entity overview

```
auth.users (Supabase-managed)
   │ 1:1 (id)
   ▼
profiles ──────────────┬──────────────┬───────────────────────┐
   │ 1:1 (user_id)      │ 1:many        │ 1:many (creator_id)    │
   ▼                    ▼               ▼                        │
verification_documents  verification_reviews (+reviewer_id fk)  events
   (owner/admin RLS)     (admin-read audit trail)                 │
                                                                   │ 1:many (event_id)
                                                    ┌──────────────┼──────────────┐
                                                    ▼              ▼              ▼
                                              join_requests    messages       ratings
                                              (user_id fk)   (user_id fk)  (from/to_user_id fk)

admin_users — standalone, references auth.users(id), no FK from profiles
crew_requests — standalone, from_user_id/to_user_id both fk → profiles(id)
```

**Known mismatch worth flagging**: `ratings` and `crew_requests` exist as real tables with full RLS, but **the app currently never writes to either of them** — `rateUser`/`getUserAverageRating`/`sendCrewRequest`/`acceptCrewRequest`/etc. in `providers/AppProvider.tsx` operate entirely on local React state seeded from `lib/mockData.ts`, not on these tables. See `FUNCTIONALITY.md` §4 for the functional detail. Don't assume these tables have real data — as of this writing they're effectively unused by the live app.

---

## 3. Tables

### 3.1 `public.profiles`

The core user row. FK'd 1:1 to `auth.users`; created automatically on first login if missing (see `FUNCTIONALITY.md` §3).

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | — | PK, FK → `auth.users(id) ON DELETE CASCADE` |
| `email` | `text` | — | Duplicated from `auth.users` for convenience |
| `name` | `text`, nullable | — | |
| `username` | `text`, nullable | — | `UNIQUE` |
| `gender` | `text`, nullable | — | app values: `'man' \| 'woman' \| 'other'`, not DB-enforced |
| `age` | `integer`, nullable | — | not DB-range-checked |
| `city` | `text`, nullable | — | |
| `bio` | `text`, nullable | — | |
| `avatar_uri` | `text` | — | Cloudinary URL, added in 002 |
| `avatar_colors` | `text[]` | `ARRAY['#8B5CF6','#6366F1']` | gradient fallback avatar |
| `verified` | `boolean` | `false` | legacy flag; kept in sync with `verification_status='approved'`; drives `VERIFIED_JOIN_BONUS` (see `FUNCTIONALITY.md` §4) |
| `verification_status` | `text`, **CHECK-constrained** (007) | `'unverified'` | `'unverified' \| 'pending' \| 'approved' \| 'rejected'` |
| `verification_submitted_at` | `timestamptz`, nullable | — | |
| `verification_rejection_reason` | `text`, nullable | — | |
| `created_at` | `timestamptz` | `now()` | |
| `updated_at` | `timestamptz` | `now()` | trigger-maintained (`update_profiles_updated_at`) |

~~`aadhaar_front_uri` / `aadhaar_back_uri` / `selfie_uri`~~ — added in 006, **dropped in 007**, moved to `verification_documents` (§3.6).

**Indexes**: `idx_profiles_username`, `idx_profiles_city`, `idx_profiles_verified`, `idx_profiles_verification_status`.

**RLS**:
```sql
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```
`SELECT` is fully open (no auth check at all) — every profile field is public to any anon client. This is intentional for browsing, but means nothing sensitive should ever be added to this table directly (hence §3.6's split).

---

### 3.2 `public.events`

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `title` | `varchar(255)` | — | not null |
| `description` | `text` | — | not null |
| `creator_id` | `uuid` | — | FK → `profiles(id) ON DELETE CASCADE` |
| `category` | `varchar(50)` | — | `CHECK IN ('movies','chill','music','sports','food','travel','gaming','other')` |
| `emoji` | `varchar(10)` | — | not null |
| `date_time` | `timestamptz` | — | not null |
| `time_slot` | `varchar(50)` | — | `CHECK IN ('Morning','Afternoon','Evening','Night')` |
| `exact_time` | `varchar(50)` | — | free text, e.g. `"HH:MM"` |
| `area` | `varchar(255)` | — | public-facing locality |
| `exact_location` | `text` | — | precise address, only shown post-approval (app-level, not RLS-level) |
| `location_note` | `text`, nullable | — | |
| `latitude` / `longitude` | `decimal(10,8)` / `decimal(11,8)`, nullable | — | |
| `map_url` | `text`, nullable | — | |
| `max_people` | `int`, nullable | — | `NULL` = unlimited |
| `women_only` | `boolean` | `false` | |
| `pinned` | `boolean` | `false` | |
| `created_at` / `updated_at` | `timestamptz` | `now()` | `updated_at` trigger-maintained |

**Indexes**: `idx_events_creator`, `idx_events_category`, `idx_events_datetime`, `idx_events_location` (on `area`), `idx_events_geo` (lat/long), `idx_events_search` (`area, date_time DESC, category`).

**RLS**:
```sql
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_insert_authenticated" ON public.events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND creator_id = auth.uid());
CREATE POLICY "events_update_creator" ON public.events FOR UPDATE
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "events_delete_creator" ON public.events FOR DELETE
  USING (auth.uid() = creator_id);
```
Note `exact_location` is readable by anyone via `events_select_all` at the DB level — the "private until approved" behavior is enforced only in the app UI (`app/event/[id].tsx`), not by RLS. Worth knowing if you ever build a second client against this DB.

---

### 3.3 `public.join_requests`

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | — | FK → `profiles(id) ON DELETE CASCADE` |
| `event_id` | `uuid` | — | FK → `events(id) ON DELETE CASCADE` |
| `status` | `varchar(50)` | `'pending'` | `CHECK IN ('pending','approved','rejected')` |
| `created_at` / `updated_at` | `timestamptz` | `now()` | `updated_at` trigger-maintained |

`UNIQUE(user_id, event_id)` — one request per user per event.

**Indexes**: `idx_join_requests_user`, `idx_join_requests_event`, `idx_join_requests_status`, partial `idx_join_requests_pending` (`WHERE status='pending'`), partial `idx_join_requests_user_approved` (`WHERE status='approved'`).

**RLS**:
```sql
CREATE POLICY "join_requests_select_own" ON public.join_requests FOR SELECT
  USING (auth.uid() = user_id OR EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()));
CREATE POLICY "join_requests_insert_own" ON public.join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "join_requests_update_creator" ON public.join_requests FOR UPDATE
  USING (EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()));
```

---

### 3.4 `public.messages`

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `event_id` | `uuid` | — | FK → `events(id) ON DELETE CASCADE` |
| `user_id` | `uuid` | — | FK → `profiles(id) ON DELETE CASCADE`, sender |
| `text` | `text` | — | not null |
| `created_at` / `updated_at` | `timestamptz` | `now()` | `updated_at` trigger-maintained |

**Indexes**: `idx_messages_event`, `idx_messages_user`, `idx_messages_created_at`, `idx_messages_recent` (`event_id, created_at DESC`).

**Realtime**: added to the `supabase_realtime` publication (migration 005) — the only table in the app with live `postgres_changes` streaming enabled.

**RLS**:
```sql
CREATE POLICY "messages_select_approved" ON public.messages FOR SELECT
  USING (EXISTS(SELECT 1 FROM events e LEFT JOIN join_requests jr ON e.id = jr.event_id
         WHERE e.id = messages.event_id
         AND (e.creator_id = auth.uid() OR (jr.user_id = auth.uid() AND jr.status = 'approved'))));
CREATE POLICY "messages_insert_approved" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS(SELECT 1 FROM events e LEFT JOIN join_requests jr ON e.id = jr.event_id
              WHERE e.id = messages.event_id
              AND (e.creator_id = auth.uid() OR (jr.user_id = auth.uid() AND jr.status = 'approved'))));
```

---

### 3.5 `public.ratings` and `public.crew_requests` — schema exists, unused by the app

Both tables are fully created with real RLS, but **no app code writes to them today** (see §2's mismatch note and `FUNCTIONALITY.md` §4). Documenting the schema as-is since it's real DB structure; don't assume any rows exist in production.

**`ratings`**:

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `from_user_id` / `to_user_id` | `uuid` | — | both FK → `profiles(id) ON DELETE CASCADE` |
| `event_id` | `uuid` | — | FK → `events(id) ON DELETE CASCADE` |
| `stars` | `int` | — | `CHECK (stars BETWEEN 1 AND 5)` |
| `comment` | `text`, nullable | — | |
| `created_at` | `timestamptz` | `now()` | no `updated_at` — ratings aren't editable in the schema's own design |

`UNIQUE(from_user_id, to_user_id, event_id)`. Indexes: `idx_ratings_from_user`, `idx_ratings_to_user`, `idx_ratings_event`, `idx_ratings_received` (duplicate of `to_user_id` index, harmless).

```sql
CREATE POLICY "ratings_select_all" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_participated" ON public.ratings FOR INSERT
  WITH CHECK (auth.uid() = from_user_id AND EXISTS(SELECT 1 FROM join_requests
              WHERE event_id = ratings.event_id AND user_id = ratings.to_user_id AND status = 'approved'));
CREATE POLICY "ratings_update_own" ON public.ratings FOR UPDATE
  USING (auth.uid() = from_user_id) WITH CHECK (auth.uid() = from_user_id);
```

**`crew_requests`**:

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `from_user_id` / `to_user_id` | `uuid` | — | both FK → `profiles(id) ON DELETE CASCADE` |
| `status` | `varchar(50)` | `'pending'` | `CHECK IN ('pending','accepted','rejected')` |
| `created_at` / `updated_at` | `timestamptz` | `now()` | `updated_at` trigger-maintained |

`UNIQUE(from_user_id, to_user_id)`. Indexes: `idx_crew_requests_from`, `idx_crew_requests_to`, `idx_crew_requests_status`.

```sql
CREATE POLICY "crew_requests_select_own" ON public.crew_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "crew_requests_insert_own" ON public.crew_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "crew_requests_update_recipient" ON public.crew_requests FOR UPDATE
  USING (auth.uid() = to_user_id) WITH CHECK (auth.uid() = to_user_id);
```

---

### 3.6 `public.verification_documents` (added in 007)

Holds the sensitive Aadhaar/selfie URLs that used to live directly on `profiles`. Split out specifically because `profiles_select_all` has no auth check — see §3.1.

| Column | Type | Default | Notes |
|---|---|---|---|
| `user_id` | `uuid` | — | PK, FK → `profiles(id) ON DELETE CASCADE` |
| `aadhaar_front_uri` | `text`, nullable | — | Cloudinary `secure_url` |
| `aadhaar_back_uri` | `text`, nullable | — | Cloudinary `secure_url` |
| `selfie_uri` | `text`, nullable | — | Cloudinary `secure_url` |
| `updated_at` | `timestamptz` | `now()` | set manually by the client on upsert — **no trigger** on this table |

```sql
CREATE POLICY "verification_documents_select_own_or_admin" ON public.verification_documents FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "verification_documents_insert_own" ON public.verification_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "verification_documents_update_own" ON public.verification_documents FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```
No `DELETE` policy for anyone — a resubmission `UPSERT`s (overwrites), never deletes.

---

### 3.7 `public.admin_users` (added in 007)

The app's only role concept.

| Column | Type | Default | Notes |
|---|---|---|---|
| `user_id` | `uuid` | — | PK, FK → `auth.users(id) ON DELETE CASCADE` |
| `created_at` | `timestamptz` | `now()` | |

RLS enabled, **zero policies** — unreachable via the API in any direction (no client role can `SELECT`/`INSERT`/`UPDATE`/`DELETE`). The only way to grant admin access is a manual SQL statement run as a superuser/service role:
```sql
insert into public.admin_users (user_id) values ('<their auth.users.id>');
```

---

### 3.8 `public.verification_reviews` (added in 007)

Immutable audit trail — one row per approve/reject decision, written only by `review_verification()` (§4).

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | — | FK → `profiles(id) ON DELETE CASCADE`, the reviewed user |
| `reviewer_id` | `uuid` | — | FK → `auth.users(id)`, the admin who decided |
| `decision` | `text` | — | `CHECK IN ('approved','rejected')` |
| `reason` | `text`, nullable | — | rejection reason, if any |
| `aadhaar_front_uri` / `aadhaar_back_uri` / `selfie_uri` | `text`, nullable | — | **snapshot** of `verification_documents` at review time — survives a later resubmission overwriting the live row |
| `reviewed_at` | `timestamptz` | `now()` | |

```sql
CREATE POLICY "verification_reviews_admin_select" ON public.verification_reviews FOR SELECT
  USING (public.is_admin());
```
No insert/update/delete policy for any client role — only `review_verification()` (SECURITY DEFINER) writes here.

---

### 3.9 `public.password_reset_otps` (added in 008)

Backs the OTP-based forgot-password flow. Not touched by the mobile app or any Supabase Edge Function — only by **together-admin**'s `app/api/forgot-password/send-otp` and `verify-otp` route handlers, via a service-role client (`together-admin/lib/supabase/admin.ts`).

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `email` | `text` | — | not the FK'd `profiles.id` — looked up by email since the requester isn't authenticated |
| `otp_hash` | `text` | — | `SHA256(otp + OTP_PEPPER)`, never the plaintext code |
| `expires_at` | `timestamptz` | — | set to `now() + 10 minutes` on insert |
| `attempts` | `int` | `0` | incremented on each failed verify; locked out at 5 |
| `consumed_at` | `timestamptz`, nullable | — | set once the OTP has been successfully used to reset a password |
| `created_at` | `timestamptz` | `now()` | also used for the 60s resend cooldown and hourly request cap |

**Indexes**: `idx_password_reset_otps_email`.

RLS enabled, **zero policies** — unreachable via the anon/authenticated API in any direction, same as `admin_users` (§3.7). Only the service-role key can read/write it.

---

## 4. Functions

| Function | Kind | Purpose |
|---|---|---|
| `public.update_updated_at_column()` | `plpgsql` trigger fn | Sets `NEW.updated_at = now()`. Attached to `profiles`, `events`, `join_requests`, `messages`, `crew_requests`. Not attached to `ratings` (no `updated_at` column) or `verification_documents`/`verification_reviews`/`admin_users` (updated_at, where present, is set by the caller, not a trigger). |
| `public.is_admin()` | `sql`, `SECURITY DEFINER`, `STABLE` | `select exists (select 1 from admin_users where user_id = auth.uid())`. Used inside RLS policies and by `review_verification()`. Granted to `anon, authenticated`. |
| `public.review_verification(target_user_id uuid, decision text, rejection_reason text default null)` | `plpgsql`, `SECURITY DEFINER` | The only way `profiles.verification_status` can change for a row that isn't your own. Raises `not authorized` if `is_admin()` is false; raises on an invalid `decision`; otherwise inserts a `verification_reviews` snapshot and updates `profiles.verification_status`/`verification_rejection_reason`/`verified` atomically. Granted to `authenticated` only. Call via `supabase.rpc('review_verification', { target_user_id, decision, rejection_reason })`. |

`SECURITY DEFINER` here means both functions run with the privileges of their owner (the migration-running role, effectively `postgres`), so they can read `admin_users` / write `profiles` and `verification_reviews` regardless of the *calling* role's own RLS visibility — this is what lets an admin's own logged-in session perform a privileged cross-user write without ever holding the Supabase service-role key.

---

## 5. Realtime

Only `public.messages` is in the `supabase_realtime` publication (migration 005). No other table streams `postgres_changes` — notably `profiles` does not, so a `verification_status` change made by an admin does **not** push live to the affected user's device; see `FUNCTIONALITY.md` for the app-side implication.

---

## 6. Edge Functions

Only one exists: `supabase/functions/delete-avatar/index.ts`.

- Deletes the calling user's Cloudinary avatar. Verifies the caller's JWT via a service-role Supabase client's `auth.getUser()`, looks up `profiles.avatar_uri` for that user only (never accepts a target id from the request body), derives the Cloudinary `public_id` from the URL, signs a `destroy` call with `CLOUDINARY_API_SECRET`, then clears `profiles.avatar_uri`.
- Deploy: `supabase functions deploy delete-avatar`. Secrets: `supabase secrets set CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...`.
- This is the template to copy for any *future* action that genuinely needs the service-role key (i.e., something `is_admin()` + a `SECURITY DEFINER` RPC can't express) — the verification admin flow deliberately did **not** need one; see §4.

The forgot-password OTP flow (§3.9) is the one other place that needs the service-role key, but it deliberately does **not** live here as an Edge Function — it's two Next.js Route Handlers in the separate `together-admin` project (`app/api/forgot-password/send-otp` and `verify-otp`), which already holds the admin panel for this same Supabase project. `app/reset-password.tsx` in this app calls those two endpoints over plain HTTP.

---

## 7. Non-Postgres storage: Cloudinary

Images are **not** in Supabase Storage.

- Cloud name `defn6q2gc` (`lib/cloudinary.ts:5`, not a secret).
- Two unsigned upload presets: `toogether_avatars` (profile photos) and `toogether_verification` (Aadhaar/selfie — kept separate deliberately to isolate sensitive ID photos from the public avatar pool).
- Upload: client → `POST https://api.cloudinary.com/v1_1/defn6q2gc/image/upload` directly, no server involved.
- Delete: only avatars, only via the `delete-avatar` Edge Function (§6). No delete path exists for verification documents.
- **Still unsigned/public delivery** — anyone with a document's URL can view it with no auth check on Cloudinary's side, independent of the Postgres RLS lockdown in §3.6. Closing this needs a Cloudinary dashboard change (switch `toogether_verification` to authenticated delivery) plus a signed-URL endpoint; not done as part of the 007 migration since it's outside what a SQL migration can do. Tracked as an open item in `FUNCTIONALITY.md`.

---

## 8. Config / env vars

```
# .env (repo root)
EXPO_PUBLIC_SUPABASE_URL=https://najyegewtbeyigppuufy.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_pDw3N9foURXtQxbiTXt2aQ_Ylwziwcs   # anon/publishable key, safe client-side
# EXPO_PUBLIC_DEV_TOOLS_ENABLED=true
```

Supabase **service-role key** is not used by the mobile app or by any RLS-based feature (including the verification admin flow) — it's currently needed only by the `delete-avatar` Edge Function, held as a Supabase secret, never as an `EXPO_PUBLIC_*` var. Cloudinary API key/secret are likewise Edge Function secrets only.

**Google Maps Android API key — not a real value yet.** `app.json`'s `android.config.googleMaps.apiKey` still holds the placeholder `REPLACE_WITH_YOUR_GOOGLE_MAPS_ANDROID_API_KEY`. `android/` is gitignored (a local `expo prebuild` artifact, regenerated from `app.json` — not checked in), so this app.json field is the one durable place the key needs to live; a matching placeholder meta-data was also dropped straight into this machine's local `android/app/src/main/AndroidManifest.xml` purely so an on-device build here can pick up a real key without a full re-prebuild while testing. `app/location-picker.tsx` (see `FUNCTIONALITY.md` §2, "Location picking") requests `PROVIDER_GOOGLE` on Android regardless, so the map renders blank/unauthorized on any build — this machine's or a fresh clone's — until someone gets a Maps SDK for Android key from Google Cloud Console and puts it in `app.json`, then runs `expo prebuild` (or a new EAS build) to bake it in.

---

## Retired docs

The following files previously duplicated or contradicted this doc and `FUNCTIONALITY.md`. They've been reduced to short pointers back here rather than deleted outright (so file history/links aren't broken): `SCHEMA_DOCUMENTATION.md`, `DATABASE_DOCUMENTATION_INDEX.md`, `API_REFERENCE.md`, `SETUP_GUIDE.md`, `CREDIT_SYSTEM.md`, `DEV_TOOLS.md`, `CURRENT_FUNCTIONALITY_STATUS.md`, `MIGRATION_UPDATES_MAY2026.md`, `docs/TOOGETHER_PRODUCT_OVERVIEW.md`, `docs/PROFILE_VERIFICATION_SYSTEM.md`. From now on, **this file and `FUNCTIONALITY.md` are the only two docs to update** when the schema or a feature changes — don't create a new topic-specific doc file.
