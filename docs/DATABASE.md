# Open Plans — Database Documentation

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
| `009_notifications.sql` | Added `notifications` + `push_tokens`, `create_notification()`, triggers on `join_requests`/`messages` that call it, extended `review_verification()` to call it too, and added `notifications` to the `supabase_realtime` publication. See §3.10, §3.11, §4, §5. |
| `010_push_notifications_webhook.sql` | Scriptable version of a Database Webhook trigger (`send_push_on_notification`) that calls the new `send-push` Edge Function on every `notifications` INSERT. On *this* project, Webhooks had never been provisioned, so running it as raw SQL failed with `schema "supabase_functions" does not exist` — the actual webhook here was created via the Dashboard's **Integrations > Webhooks** instead (moved there from Database in a 2026 dashboard reorg — same name/table/URL, see the file's header comment). The SQL is a no-op-with-notice, not an error, on any project without the schema, so it's still safe to run. See §4, §6. |
| `011_soft_delete_and_retention.sql` | Replaced hard-delete of `events` with a soft delete (`deleted_at`) plus a bounded retention window; tightened `events_select_all`, `events_delete_creator` (now admin-only), `join_requests_insert_own`/`select_own`, `messages_select_approved`. See §3.2. |
| `012_enable_feed_realtime.sql` | Added `join_requests` and `events` to the `supabase_realtime` publication, for AppProvider's `feed-realtime` channel (live join requests/approvals and feed updates). See §5. |
| `019_karma_and_crew_recommendations.sql` | Karma replaces ratings: `get_karma(uuid[])` derives each user's karma from `events` / `join_requests` / `crew_requests` / `profiles` on read (no new table, no triggers). `get_crew_recommendations(int)` ranks people to add by shared plans, mutual crew and same city. Both `SECURITY DEFINER`, return counts only. The unused `ratings` table is left in place. See §4. |
| `018_members_visibility_and_reports.sql` | `join_requests_select_own` also lets approved members read the plan's other *approved* rows, so members see who's going. New `member_reports` table (RLS: reporter, host for reports about members, admins), `report_member()` / `resolve_member_reports()`, notification type `member_reported`, realtime. See §3.3, §3.12, §4. |
| `017_restrict_event_edits.sql` | `restrict_event_edits()` BEFORE UPDATE trigger: non-admins can only change `description` and `date_time` (+ its `exact_time` / `time_slot` labels), only before the start, and `date_time` only within the same calendar day in India time. Cancelling (`deleted_at`) is always allowed. `handle_event_time_change()` notifies approved members (`event_time_changed`, new notification type). See §3.2, §4. |
| `016_archive_after_6h_and_1_month_window.sql` | Plans **archive 6h after `date_time`**: `events_select_all` then only returns the row to its host and approved members (via the new `is_event_member()` helper), and `messages_select_approved` / `messages_insert_approved` close the chat for everyone. Admins keep everything. `validate_event()` start window cut from 2 years to 1 month (+1 day slack). Replaces 011's 48h public window. See §3.2, §3.4, §4. |
| `015_event_validation_and_crew_removal.sql` | `validate_event()` BEFORE INSERT/UPDATE trigger on `events`: title 3–60, non-blank locality and address, description ≤200, `max_people` required on insert and 2–10 whenever set, start between 15 minutes and 2 years ahead (checked when `date_time` is set or changed). Also `remove_from_crew()`. See §3.2, §4. |
| `014_real_crew_and_event_invites.sql` | Crew goes real: drops the client INSERT/UPDATE policies on `crew_requests` (they allowed forging an `accepted` row) in favour of `send_crew_request()` / `respond_to_crew_request()`, adds a notification trigger, and adds the table to `supabase_realtime`. Event invites: new `join_requests` status `'invited'`, `invite_to_event()` / `respond_to_invite()`, and both join-request triggers extended. Five new notification types. See §3.3, §3.5, §3.10, §4, §5. **Needs 013 first; the app depends on both.** |
| `013_rerequests_member_removal_dismiss.sql` | `join_requests.attempts` + `rerequest_to_join()` RPC (a declined requester can send up to 3 requests in total); new `join_requests` status `'removed'` (host removes a member); `notifications.dismissed_at` (Activity swipe-to-remove) and notification type `'join_request_removed'`; `handle_join_request_status_change()` now also notifies on `removed` and on a re-request. See §3.3, §3.10, §4. **The app depends on it**: without it the Activity inbox query fails (no `dismissed_at`), re-requests and removals error. |

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
notifications — standalone, user_id fk → profiles(id), written only by create_notification() (§3.10)
push_tokens — standalone, user_id fk → profiles(id), owner-managed (§3.11)
```

**Unused table**: `ratings` exists with full RLS, but the app never wrote to it, and since 019 the app has no ratings at all (karma replaced them, computed by `get_karma()`). It's kept only so no data is destroyed; safe to drop later. (`crew_requests` was in the same state until migration 014; it's used for real now.)

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
| `bio` | `text`, nullable | — | unused by the app since 2026-10-11 (field removed from Edit profile); kept so old rows aren't lost |
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
| `deleted_at` | `timestamptz`, nullable | — | added in `011`; set (not `DELETE`d) when a creator cancels a plan — see retention model below |
| `created_at` / `updated_at` | `timestamptz` | `now()` | `updated_at` trigger-maintained |

**Indexes**: `idx_events_creator`, `idx_events_category`, `idx_events_datetime`, `idx_events_location` (on `area`), `idx_events_geo` (lat/long), `idx_events_search` (`area, date_time DESC, category`), `idx_events_deleted_at` (partial, `WHERE deleted_at IS NOT NULL`, added in `011`).

**RLS**:
```sql
CREATE POLICY "events_select_all" ON public.events FOR SELECT
  USING (
    public.is_admin()
    OR (
      deleted_at IS NULL
      AND (
        date_time > now() - interval '6 hours'   -- public until 6h after start
        OR creator_id = auth.uid()               -- then host ...
        OR public.is_event_member(id)            -- ... and approved members only
      )
    )
  );
CREATE POLICY "events_insert_authenticated" ON public.events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND creator_id = auth.uid());
CREATE POLICY "events_update_creator" ON public.events FOR UPDATE
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "events_delete_admin_only" ON public.events FOR DELETE
  USING (public.is_admin());
```
**Edit restrictions (added in `017`)**: `restrict_event_edits_before_update` raises if a non-admin update changes anything other than `description`, `date_time`, `exact_time`, `time_slot`, `deleted_at`, `updated_at`. Changes to the allowed fields (except `deleted_at`) are refused once the plan has started, and a new `date_time` must fall on the same calendar day as the old one in `Asia/Kolkata`. Since the date can never change, a plan can't be pushed back day after day. India time is hardcoded because the app is India-only. It runs alongside `validate_event()`, which still requires the new time to be ≥15 minutes away.

**Validation (added in `015`)**: the `validate_event_before_write` trigger (`validate_event()`, §4) rejects an insert or update that breaks the create-plan form's rules: title 3–60 characters, locality and exact address not blank, description at most 200, `max_people` between 2 and 10. `max_people` is required on insert; older rows with `NULL` are left alone. The start must be at least 15 minutes and at most 1 month away (2 years until `016`; the bound has a day of slack for the app's local-date picker vs. UTC), checked only when `date_time` is inserted or changed, so editing other fields of a plan that has already started still works. Soft delete (`deleted_at`) isn't in the trigger's column list and never runs it.

Note `exact_location` is readable by anyone via `events_select_all` at the DB level — the "private until approved" behavior is enforced only in the app UI (`app/event/[id].tsx`), not by RLS. Worth knowing if you ever build a second client against this DB.

**Soft delete + archiving (`011`, archiving changed in `016`)**: `deleteEvent` (`providers/AppProvider.tsx`) no longer issues a `DELETE` — it `UPDATE`s `deleted_at = now()` (allowed by the existing `events_update_creator` policy, no separate policy needed for that direction). Regular hard `DELETE` is admin-only, so a plain client-side cancel can never destroy the row. Nothing is ever removed automatically (no cron/Edge Function):

- **Cancelled** (`deleted_at` set): hidden from every non-admin user immediately; admin-queryable until purged.
- **Archived** (6h after `date_time`, since `016`): the row stays readable only to the host and approved members, who see it as a list entry in Profile → Past plans. Everyone else loses it. The chat closes for everyone, including the host and members (§3.4). Admins still see the event, its requests and its chat. Archived plans are kept indefinitely; they're the members' history. Before `016`, a finished plan stayed fully public for 48h and then went admin-only.

`events_select_all`'s membership check goes through `is_event_member()` (`SECURITY DEFINER`, §4) rather than an inline subquery on `join_requests`. `join_requests_select_own` already queries `events`, and two policies that reference each other make Postgres fail with "infinite recursion detected in policy".

Because `join_requests_select_own`/`insert_own` and `messages_select_approved` (§3.3, §3.4) gate visibility through a subquery into `events`, and Postgres RLS subqueries are themselves subject to the referenced table's policies, tightening `events_select_all` alone also cuts off a regular user's visibility into a deleted/expired event's join requests and chat — those tables only needed an added `OR public.is_admin()` so admins retain the full picture (event + requests + chat) during the retention window, for the "investigate a complaint" case.

Purge is manual. Since `016`, only **cancelled** plans should be purged; archived ones are the members' Past plans history and disappear from it if deleted. Run this (as an admin/service role) when ready (cascades to `join_requests`/`messages`/`notifications`/`ratings` via their FKs):
```sql
DELETE FROM public.events
WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '72 hours';
```

---

### 3.3 `public.join_requests`

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | — | FK → `profiles(id) ON DELETE CASCADE` |
| `event_id` | `uuid` | — | FK → `events(id) ON DELETE CASCADE` |
| `status` | `varchar(50)` | `'pending'` | `CHECK IN ('pending','approved','rejected','removed','invited')` (`removed` added in `013`, `invited` in `014`). `invited` is a host's invite awaiting the invitee's answer and grants nothing until accepted |
| `attempts` | `int` | `1` | added in `013`; how many times this request has been sent. Bumped only by `rerequest_to_join()` (§4) |
| `created_at` / `updated_at` | `timestamptz` | `now()` | `updated_at` trigger-maintained |

`UNIQUE(user_id, event_id)` — one request per user per event. A re-request after a decline reuses that row (`rejected` → `pending`, `attempts + 1`, max 3) rather than inserting a new one. `removed` is set by the host through `join_requests_update_creator` and is final: chat/details RLS only admits `approved`, and `rerequest_to_join()` only accepts `rejected`.

**Indexes**: `idx_join_requests_user`, `idx_join_requests_event`, `idx_join_requests_status`, partial `idx_join_requests_pending` (`WHERE status='pending'`), partial `idx_join_requests_user_approved` (`WHERE status='approved'`).

**RLS**:
```sql
CREATE POLICY "join_requests_select_own" ON public.join_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid())
    OR (status = 'approved' AND public.is_event_member(event_id))   -- added in 018
    OR public.is_admin()
  );
CREATE POLICY "join_requests_insert_own" ON public.join_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS(SELECT 1 FROM events WHERE id = event_id AND date_time > now())
  );
CREATE POLICY "join_requests_update_creator" ON public.join_requests FOR UPDATE
  USING (EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()));
```
There's no requester-side UPDATE policy, so a requester can't flip their own row; the re-request goes through the `SECURITY DEFINER` `rerequest_to_join()` (§4) instead. `insert_own` also means a host can't insert a row for someone else, so invites go through `invite_to_event()` / `respond_to_invite()` (§4, migration 014).

`insert_own` (added in `011`) blocks new join requests once the event's `date_time` has passed — mirrors the app-level check in `requestToJoin` (`providers/AppProvider.tsx`). `select_own`'s `is_admin()` clause (also `011`) is for the deleted/completed-event retention window — see §3.2.

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

**Realtime**: added to the `supabase_realtime` publication (migration 005). See §5 for the other streamed tables.

**RLS**:
```sql
CREATE POLICY "messages_select_approved" ON public.messages FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.events e
      WHERE e.id = messages.event_id
        AND e.deleted_at IS NULL
        AND e.date_time > now() - interval '6 hours'
        AND (e.creator_id = auth.uid() OR public.is_event_member(e.id)))
  );
CREATE POLICY "messages_insert_approved" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.events e
      WHERE e.id = messages.event_id
        AND e.deleted_at IS NULL
        AND e.date_time > now() - interval '6 hours'
        AND (e.creator_id = auth.uid() OR public.is_event_member(e.id)))
  );
```
Both rewritten in `016`: the chat closes, for reading and writing, 6h after the plan's start. `select_approved`'s `is_admin()` clause (added in `011`) keeps the whole chat available to admins, including after archiving and cancellation (§3.2).

---

### 3.5 `public.ratings` (unused by the app) and `public.crew_requests` (real since 014)

`ratings` is fully created with real RLS, but **no app code reads or writes it** (ratings were removed from the app in 019 in favour of karma) (see §2's mismatch note and `FUNCTIONALITY.md` §4); don't assume any rows exist in production. `crew_requests` backs the real crew feature since migration 014.

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
```
That's the only policy since 014. 004's `crew_requests_insert_own` (only checked `from_user_id`, so a client could insert a row already `accepted`, a forged connection with anyone) and `crew_requests_update_recipient` (let the recipient rewrite `from_user_id`) were dropped. All writes go through `send_crew_request()` and `respond_to_crew_request()` (§4). A pair has at most one live row: `send_crew_request()` deletes a declined row before sending a fresh one, and accepts the other direction's pending request instead of creating a second row. A trigger notifies on a new request and on acceptance (§4). In `supabase_realtime` (§5).

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

### 3.10 `public.notifications` (added in 009)

The in-app notification feed. One row per event a user should be told about — see `FUNCTIONALITY.md` §9 for the feature-level picture.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | — | FK → `profiles(id) ON DELETE CASCADE`, the recipient |
| `type` | `text`, **CHECK-constrained** | — | `'join_request_received' \| 'join_request_approved' \| 'join_request_rejected' \| 'join_request_removed' \| 'verification_approved' \| 'verification_rejected' \| 'new_message'` (`member_reported` added in `018`; `event_time_changed` added in `017`; `join_request_removed` added in `013`; `event_invite_received`, `event_invite_accepted`, `event_invite_declined`, `crew_request_received`, `crew_request_accepted` added in `014`) |
| `title` / `body` | `text` | — | pre-rendered human-readable copy, written by the trigger/function that creates the row — the client never has to reconstruct it from `type` |
| `data` | `jsonb` | `'{}'` | deep-link payload, always includes `route` (an app path like `/event/<id>` or `/chat/<id>`); `eventId`/`actorId` included where relevant |
| `read_at` | `timestamptz`, nullable | — | set by the client via `notifications_update_own` when the user opens/dismisses it |
| `dismissed_at` | `timestamptz`, nullable | — | added in `013`; soft delete set when the user swipes the row away in Activity (cleared again by Undo), via `notifications_update_own`. The app's inbox query excludes these rows |
| `created_at` | `timestamptz` | `now()` | |

**Indexes**: `idx_notifications_user_created` (`user_id, created_at DESC`), partial `idx_notifications_user_unread` (`user_id WHERE read_at IS NULL`).

```sql
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```
No INSERT/DELETE policy for any client role — rows are written only by `create_notification()` (§4), the same "no direct client write" pattern as `verification_reviews` (§3.8).

---

### 3.11 `public.push_tokens` (added in 009)

Expo push tokens per device. Populated by `providers/NotificationsProvider.tsx` on login (owner upserts its own row), removed by `AppProvider.logout()` via `lib/pushToken.ts` while the session is still valid (the delete policy needs `auth.uid()`, so it must run before `signOut()`), and read by the `send-push` Edge Function (§6, added in 010) via a service-role client to relay a push.

| Column | Type | Default | Notes |
|---|---|---|---|
| `user_id` | `uuid` | — | FK → `profiles(id) ON DELETE CASCADE` |
| `token` | `text` | — | Expo push token |
| `platform` | `text`, CHECK-constrained | — | `'ios' \| 'android'` |
| `created_at` / `updated_at` | `timestamptz` | `now()` | not trigger-maintained — set by the client on upsert |

PK `(user_id, token)` — supports multiple devices per user.

```sql
CREATE POLICY "push_tokens_select_own" ON public.push_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_tokens_insert_own" ON public.push_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_tokens_update_own" ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_tokens_delete_own" ON public.push_tokens FOR DELETE USING (auth.uid() = user_id);
```
Fully owner-managed — a device registers and can remove its own token, nothing else touches this table via the client API.

---

### 3.12 `public.member_reports` (added in 018)

Reports about someone in a plan, written from the app's Members screen (`FUNCTIONALITY.md` §2).

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `event_id` | `uuid` | — | FK → `events(id) ON DELETE CASCADE` |
| `reporter_id` / `reported_id` | `uuid` | — | both FK → `profiles(id) ON DELETE CASCADE`; `CHECK (reporter_id <> reported_id)` |
| `reason` | `text` | — | `CHECK (length(btrim(reason)) BETWEEN 10 AND 500)` |
| `created_at` | `timestamptz` | `now()` | |
| `resolved_at` | `timestamptz`, nullable | — | set when the host acts |
| `resolution` | `text`, nullable | — | `'removed' \| 'dismissed'` |

Indexes: `idx_member_reports_event`, `idx_member_reports_reported`, partial unique `idx_member_reports_one_open (event_id, reporter_id, reported_id) WHERE resolved_at IS NULL` (one open report per reporter/person/plan).

```sql
CREATE POLICY "member_reports_select" ON public.member_reports FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.events e
      WHERE e.id = member_reports.event_id AND e.creator_id = auth.uid()
        AND member_reports.reported_id <> e.creator_id)
  );
```
No client write policies; rows are created by `report_member()` and resolved by `resolve_member_reports()` (§4). Reports about the host are visible only to the reporter and admins. In `supabase_realtime` (§5). For the admin panel: open reports are `WHERE resolved_at IS NULL`, and reports about hosts are the rows where `reported_id = events.creator_id`. Nothing in the app surfaces those, so they need admin follow-up.

---

## 4. Functions

| Function | Kind | Purpose |
|---|---|---|
| `public.update_updated_at_column()` | `plpgsql` trigger fn | Sets `NEW.updated_at = now()`. Attached to `profiles`, `events`, `join_requests`, `messages`, `crew_requests`. Not attached to `ratings` (no `updated_at` column) or `verification_documents`/`verification_reviews`/`admin_users` (updated_at, where present, is set by the caller, not a trigger). |
| `public.is_admin()` | `sql`, `SECURITY DEFINER`, `STABLE` | `select exists (select 1 from admin_users where user_id = auth.uid())`. Used inside RLS policies and by `review_verification()`. Granted to `anon, authenticated`. |
| `public.review_verification(target_user_id uuid, decision text, rejection_reason text default null)` | `plpgsql`, `SECURITY DEFINER` | The only way `profiles.verification_status` can change for a row that isn't your own. Raises `not authorized` if `is_admin()` is false; raises on an invalid `decision`; otherwise inserts a `verification_reviews` snapshot, updates `profiles.verification_status`/`verification_rejection_reason`/`verified` atomically, and (since 009) calls `create_notification()` so the user sees the decision in their inbox. Granted to `authenticated` only. Call via `supabase.rpc('review_verification', { target_user_id, decision, rejection_reason })`. |
| `public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')` | `plpgsql`, `SECURITY DEFINER` | Added in 009. The single write path for `notifications` — plain `INSERT`. Not granted to `anon`/`authenticated`; only called from other `SECURITY DEFINER` functions owned by the same role (the triggers below, and `review_verification()`), which is sufficient for Postgres to allow the call without a public grant. |
| `public.handle_join_request_insert()` | `plpgsql` trigger fn, `SECURITY DEFINER` | Added in 009, replaced in 014. `AFTER INSERT ON join_requests`. A `pending` row notifies the event's host; an `invited` row notifies the invitee (`event_invite_received`). The old auto-approved-invite branch is gone. |
| `public.handle_join_request_status_change()` | `plpgsql` trigger fn, `SECURITY DEFINER` | Added in 009, replaced in 013 and 014. `AFTER UPDATE OF status ON join_requests`, only when the status actually changed. `invited` → `approved` notifies the **host** (`event_invite_accepted`); any other → `approved` notifies the requester. → `invited` notifies the invitee. → `rejected` / `removed` notify the requester (the decline copy says whether another request is possible). → `pending` (a re-request) notifies the host. |
| `public.send_crew_request(p_to_user_id uuid)` | `plpgsql`, `SECURITY DEFINER`, returns `text` | Added in 014. The only way to create a crew request. Clears a declined row between the pair. If the other person already asked you, it accepts their request; otherwise it inserts a `pending` row from you. Returns `'connected'` or `'pending'`. Granted to `authenticated`. |
| `public.respond_to_crew_request(p_request_id uuid, p_accept boolean)` | `plpgsql`, `SECURITY DEFINER` | Added in 014. The recipient of a `pending` request sets it to `accepted` / `rejected`; raises otherwise. Granted to `authenticated`. |
| `public.handle_crew_request_change()` | `plpgsql` trigger fn, `SECURITY DEFINER` | Added in 014. `AFTER INSERT OR UPDATE OF status ON crew_requests`. New pending request → the recipient (`crew_request_received`, route `/user/<sender>`); accepted → the sender (`crew_request_accepted`). |
| `public.invite_to_event(p_event_id uuid, p_user_id uuid)` | `plpgsql`, `SECURITY DEFINER` | Added in 014. Caller must be the event's host and in an accepted crew with the invitee. The event must not be deleted, started or full, and must pass the women-only check. Inserts an `invited` row, or flips an earlier `rejected`/`removed` row to `invited`; raises if they're already approved, invited or pending. Granted to `authenticated`. |
| `public.respond_to_invite(p_event_id uuid, p_accept boolean)` | `plpgsql`, `SECURITY DEFINER` | Added in 014. The invitee's own `invited` row: accept → `approved` (re-checks not started / not full; the status trigger notifies the host); decline → row deleted, host notified (`event_invite_declined`). Granted to `authenticated`. |
| `public.report_member(p_event_id uuid, p_reported_id uuid, p_reason text)` | `plpgsql`, `SECURITY DEFINER` | Added in 018. Caller and reported person must both be the host or an approved member of a live plan, not the same person. Reason must be 10–500 characters after trimming. One open report per reporter/person/plan. Inserts into `member_reports`, and notifies the host (`member_reported`, route `/event-members/<id>`, actor = reporter) unless the report is about the host or by the host. Granted to `authenticated`. |
| `public.resolve_member_reports(p_event_id uuid, p_reported_id uuid, p_remove boolean)` | `plpgsql`, `SECURITY DEFINER` | Added in 018. Host only. Resolves every open report about that person in the plan (`removed`/`dismissed`); with `p_remove`, also sets their join request to `removed`, which fires the usual removal notification. Granted to `authenticated`. |
| `public.restrict_event_edits()` | `plpgsql` trigger fn | Added in 017. `BEFORE UPDATE ON events`; see §3.2's edit-restrictions note. Skipped for `is_admin()`. |
| `public.handle_event_time_change()` | `plpgsql` trigger fn, `SECURITY DEFINER` | Added in 017. `AFTER UPDATE OF date_time ON events` (not for cancelled plans): notifies each approved member (`event_time_changed`, body uses the new `exact_time`). |
| `public.is_event_member(p_event_id uuid)` | `sql`, `SECURITY DEFINER`, `STABLE` | Added in 016. Whether the caller has an `approved` join request on that event. Used by `events_select_all` and the `messages` policies; `SECURITY DEFINER` so it reads `join_requests` without RLS, avoiding a policy recursion (§3.2). Granted to `authenticated`. |
| `public.validate_event()` | `plpgsql` trigger fn | Added in 015, start window changed to 1 month in 016. `BEFORE INSERT OR UPDATE OF title, area, exact_location, description, max_people, date_time ON events`. See §3.2's validation note. Not `SECURITY DEFINER`, as it only reads `NEW`/`OLD`. |
| `public.remove_from_crew(p_user_id uuid)` | `plpgsql`, `SECURITY DEFINER` | Added in 015. Deletes every `crew_requests` row between the caller and `p_user_id` (accepted, or pending either way) and any `invited` join request between them (on either one's events). Approved memberships are untouched; no notification. Granted to `authenticated`. |
| `public.get_karma(p_user_ids uuid[])` | `sql`, `SECURITY DEFINER`, `STABLE` | Added in 019. One row per given profile: `karma` plus its parts (`plans_hosted`, `plans_hosted_happened`, `guests_hosted`, `plans_joined`, `crew_count`, `verified`, `times_removed`, `late_cancels`). Point table is in the migration header and `FUNCTIONALITY.md` §4 (mirrored by `lib/karma.ts` `KARMA_RULES`). Cancelled plans earn nothing; crew counts up to 20; floored at 0. Definer rights let it count archived plans and other people's requests, but it returns only counts. The app calls it for every known profile, which is fine at current scale; with many thousands of users it should move to a stored, trigger-maintained column. Granted to `authenticated`. |
| `public.get_crew_recommendations(p_limit int default 30)` | `sql`, `SECURITY DEFINER`, `STABLE` | Added in 019. People for the caller to add to their crew: `user_id`, `shared_plans` (non-cancelled plans you were both host/approved in), `mutual_crew` (your crew members they're connected to), `same_city` (case/space-insensitive), `score` = 10·shared + 4·mutual + 1·same city. Excludes the caller, anyone with any `crew_requests` row with the caller (crew, pending either way, declined either way) and anyone scoring 0. Ordered by score then newest profile, limit clamped 1–100. Definer rights are needed for mutual crew (crew_requests RLS only shows your own rows); only counts are returned. Granted to `authenticated`. |
| `public.rerequest_to_join(p_event_id uuid)` | `plpgsql`, `SECURITY DEFINER`, returns `int` | Added in 013. The caller's own declined request for that event goes back to `pending` with `attempts + 1`; returns the new count. Raises if there's no `rejected` request, if `attempts` is already 3, or if the event is deleted or has started. Granted to `authenticated` only. |
| `public.handle_new_message()` | `plpgsql` trigger fn, `SECURITY DEFINER` | Added in 009. `AFTER INSERT ON messages`. Notifies the event's creator plus every `approved` joiner, excluding the sender (dedup via `UNION`). |
| `supabase_functions.http_request(...)` (trigger `send_push_on_notification`) | built-in trigger fn (not app-authored) | `AFTER INSERT ON notifications`. The standard mechanism behind Supabase's Database Webhooks — fires an async HTTP POST (via `pg_net`) to the `send-push` Edge Function (§6) with the new row as payload. Never blocks or fails the triggering `INSERT`, even if the function call errors. Created via the Dashboard's Database > Webhooks UI on this project (see 010's migration-history note above); `010_push_notifications_webhook.sql` is the scriptable equivalent for a project where Webhooks is already provisioned. |

`SECURITY DEFINER` here means these functions run with the privileges of their owner (the migration-running role, effectively `postgres`), so they can read/write tables regardless of the *calling* role's own RLS visibility — this is what lets an admin's own logged-in session perform a privileged cross-user write, and what lets a trigger fired by any authenticated user's insert/update write a `notifications` row for a *different* user, without ever handing the Supabase service-role key to a client.

---

## 5. Realtime

`public.messages` (migration 005), `public.notifications` (migration 009), `public.join_requests` + `public.events` (migration 012), `public.crew_requests` (migration 014), and `public.member_reports` (migration 018) are in the `supabase_realtime` publication. Realtime filters every change through the table's SELECT RLS per subscriber, so a join request only reaches its requester and the event's host. A soft-delete (`deleted_at` set) makes the row invisible under `events_select_all`, so that UPDATE usually isn't delivered at all; the client's foreground resync drops such rows instead. No other table streams `postgres_changes` — notably `profiles` still does not, so a `verification_status` change made by an admin doesn't push live via a `profiles` subscription; the `notifications` row `review_verification()` now writes is how the client actually learns about it live instead (see `FUNCTIONALITY.md` §9).

---

## 6. Edge Functions

Two exist:

- `supabase/functions/delete-avatar/index.ts` — deletes the calling user's Cloudinary avatar. Verifies the caller's JWT via a service-role Supabase client's `auth.getUser()`, looks up `profiles.avatar_uri` for that user only (never accepts a target id from the request body), derives the Cloudinary `public_id` from the URL, signs a `destroy` call with `CLOUDINARY_API_SECRET`, then clears `profiles.avatar_uri`. Since 2026-10-11 the clear only applies if `avatar_uri` still equals the URL it deleted, so it can't wipe a new photo the app saved in the meantime. Deploy: `supabase functions deploy delete-avatar`. Secrets: `supabase secrets set CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...`. This is the template to copy for any *future* action that genuinely needs the service-role key (i.e., something `is_admin()` + a `SECURITY DEFINER` RPC can't express) — the verification admin flow deliberately did **not** need one; see §4.
- `supabase/functions/send-push/index.ts` (added in 010) — invoked by the `send_push_on_notification` Database Webhook (§4) on every `notifications` INSERT. Uses a service-role client to read the recipient's `push_tokens` (§3.11), then POSTs to Expo's hosted push API (`https://exp.host/--/api/v2/push/send`) — Expo's own documented endpoint, which relays to FCM v1 (Android) and APNs (iOS) from a single call; nothing here is platform-specific. Deletes any token Expo reports back as `DeviceNotRegistered`. **Chat pushes are grouped per plan (2026-10-08)**: for a `new_message` row it re-reads that recipient's unread `new_message` rows for the same `data.eventId`. If there's more than one, it sends a summary instead of the row's own title/body: title `<plan> (N messages)`, body the last 5 as `FirstName: text` lines (sender names from `profiles.name` via `data.actorId`). Every chat push carries `tag` (Android, replaces the notification already shown) and `threadId` (iOS, stacks them), both `chat-<eventId>`. If any lookup fails it falls back to the single-message title/body. No custom secrets to set — `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected into every Edge Function. Deploy: `supabase functions deploy send-push`.

The forgot-password OTP flow (§3.9) is the one other place that needs the service-role key, but it deliberately does **not** live here as an Edge Function — it's two Next.js Route Handlers in the separate `together-admin` project (`app/api/forgot-password/send-otp` and `verify-otp`), which already holds the admin panel for this same Supabase project. `app/reset-password.tsx` in this app calls those two endpoints over plain HTTP.

---

## 7. Non-Postgres storage: Cloudinary

Images are **not** in Supabase Storage.

- Cloud name `defn6q2gc` (`lib/cloudinary.ts:5`, not a secret).
- Two unsigned upload presets: `toogether_avatars` (profile photos) and `toogether_verification` (Aadhaar/selfie — kept separate deliberately to isolate sensitive ID photos from the public avatar pool).
- Upload: client → `POST https://api.cloudinary.com/v1_1/defn6q2gc/image/upload` directly, no server involved.
- **Uploads broke from 2026-08-25 to 2026-10-11.** Since 2026-08-25 `lib/cloudinary.ts` shrinks each photo (`expo-image-manipulator`, 1600px wide JPEG) before uploading. Production data shows no successful avatar upload after Aug 13, and every verification attempt on Oct 9–10 failed upload, while August submissions went through. The likely cause is app binaries built before that native module existed, where the shrink call throws; a Cloudinary-side refusal wasn't ruled out. The shrink step is now best-effort: on failure the original photo is uploaded. **How the photo is sent (2026-10-11)**: the shrunk photo goes up as a base64 data URI in a JSON body (`{ file, upload_preset }`), which Cloudinary accepts. The multipart `{ uri, name, type }` file upload is now only the fallback, used when shrinking isn't available. Profile-photo uploads in Expo Go failed with "Couldn't reach the photo server" on the multipart path, React Native's usual symptom when the native side can't read or stream the file. The JSON upload was confirmed working in Expo Go the same day. Errors now include the underlying reason (e.g. "Network request failed") or Cloudinary's own refusal message.
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

**Auth session persistence (`utils/supabase.ts`)**: the Supabase client's `storage` adapter keeps only a small random AES key in `expo-secure-store` and stores the actual session — encrypted with that key — in `AsyncStorage`, to stay well under SecureStore's ~2048-byte per-value limit without the crash-unsafe multi-key chunking this used to do. See `FUNCTIONALITY.md` §3 for the full rationale and the cold-start auth-bootstrap logic this pairs with.

**Google Maps Android API key — not a real value yet.** `app.json`'s `android.config.googleMaps.apiKey` still holds the placeholder `REPLACE_WITH_YOUR_GOOGLE_MAPS_ANDROID_API_KEY`. `android/` is gitignored (a local `expo prebuild` artifact, regenerated from `app.json` — not checked in), so this app.json field is the one durable place the key needs to live; a matching placeholder meta-data was also dropped straight into this machine's local `android/app/src/main/AndroidManifest.xml` purely so an on-device build here can pick up a real key without a full re-prebuild while testing. `app/location-picker.tsx` (see `FUNCTIONALITY.md` §2, "Location picking") requests `PROVIDER_GOOGLE` on Android regardless, so the map renders blank/unauthorized on any build — this machine's or a fresh clone's — until someone gets a Maps SDK for Android key from Google Cloud Console and puts it in `app.json`, then runs `expo prebuild` (or a new EAS build) to bake it in.

---

## Retired docs

The following files previously duplicated or contradicted this doc and `FUNCTIONALITY.md`. They've been reduced to short pointers back here rather than deleted outright (so file history/links aren't broken): `SCHEMA_DOCUMENTATION.md`, `DATABASE_DOCUMENTATION_INDEX.md`, `API_REFERENCE.md`, `SETUP_GUIDE.md`, `CREDIT_SYSTEM.md`, `DEV_TOOLS.md`, `CURRENT_FUNCTIONALITY_STATUS.md`, `MIGRATION_UPDATES_MAY2026.md`, `docs/TOOGETHER_PRODUCT_OVERVIEW.md`, `docs/PROFILE_VERIFICATION_SYSTEM.md`. From now on, **this file and `FUNCTIONALITY.md` are the only two docs to update** when the schema or a feature changes — don't create a new topic-specific doc file.
