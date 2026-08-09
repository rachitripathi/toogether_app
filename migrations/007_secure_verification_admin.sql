-- Toogether App - Secure verification documents + admin review capability
-- Version: 1.0
-- Why: profiles_select_all (migration 001) has no auth check at all, which meant every
-- user's Aadhaar front/back + liveness selfie URLs (and rejection reason) were readable by
-- anyone holding the app's public anon key. It also meant there was no way for an admin to
-- change someone else's verification_status — profiles_update_own only allows auth.uid() = id.
-- This migration:
--   1. Moves the three sensitive document URLs off `profiles` into a new `verification_documents`
--      table, readable only by the owner or an admin.
--   2. Introduces `admin_users` + `is_admin()` as the app's first role concept.
--   3. Adds `verification_reviews` as an immutable audit trail of every approve/reject decision,
--      snapshotting the document URLs at review time (so a later resubmission can't erase
--      evidence of what was actually reviewed).
--   4. Adds `review_verification()`, a SECURITY DEFINER RPC that is the *only* way
--      verification_status can be changed for a row that isn't your own — it checks is_admin()
--      itself, so no client ever needs (or gets) the Supabase service-role key.
-- Safe to re-run: guarded with IF NOT EXISTS / OR REPLACE throughout, except the data
-- migration + column drops, which are naturally idempotent (columns are gone after the first run).

-- 1. Admin role table. Deliberately has RLS enabled with ZERO policies, so no role
-- (anon, authenticated, or otherwise) can read/write it via the API — only the Postgres
-- superuser (i.e. you, via the Supabase SQL editor / service role) can grant admin access:
--   insert into public.admin_users (user_id) values ('<their auth.users.id>');
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.admin_users enable row level security;

-- 2. Helper predicate used by RLS policies and the RPC below. SECURITY DEFINER so it can
-- read admin_users regardless of the calling role's own RLS visibility into that table.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 3. Move sensitive document URLs off the publicly-readable `profiles` table.
create table if not exists public.verification_documents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  aadhaar_front_uri text,
  aadhaar_back_uri text,
  selfie_uri text,
  updated_at timestamptz default now()
);

insert into public.verification_documents (user_id, aadhaar_front_uri, aadhaar_back_uri, selfie_uri, updated_at)
select id, aadhaar_front_uri, aadhaar_back_uri, selfie_uri, coalesce(verification_submitted_at, now())
from public.profiles
where aadhaar_front_uri is not null or aadhaar_back_uri is not null or selfie_uri is not null
on conflict (user_id) do nothing;

alter table public.profiles drop column if exists aadhaar_front_uri;
alter table public.profiles drop column if exists aadhaar_back_uri;
alter table public.profiles drop column if exists selfie_uri;

alter table public.verification_documents enable row level security;

create policy "verification_documents_select_own_or_admin"
  on public.verification_documents for select
  using (auth.uid() = user_id or public.is_admin());

create policy "verification_documents_insert_own"
  on public.verification_documents for insert
  with check (auth.uid() = user_id);

create policy "verification_documents_update_own"
  on public.verification_documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy for anyone (including admins) — documents are only ever superseded by a
-- resubmission (upsert), never removed via the API.

-- 4. Enforce valid verification_status values at the DB level (previously app-enforced only).
alter table public.profiles drop constraint if exists profiles_verification_status_check;
alter table public.profiles
  add constraint profiles_verification_status_check
  check (verification_status in ('unverified', 'pending', 'approved', 'rejected'));

-- 5. Immutable audit trail of review decisions.
create table if not exists public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  aadhaar_front_uri text,
  aadhaar_back_uri text,
  selfie_uri text,
  reviewed_at timestamptz default now()
);
alter table public.verification_reviews enable row level security;

create policy "verification_reviews_admin_select"
  on public.verification_reviews for select
  using (public.is_admin());

-- No insert/update/delete policy for any client role — rows are only ever written by
-- review_verification() below, which runs as SECURITY DEFINER and bypasses RLS to do so.

-- 6. The only path by which verification_status can change for someone else's row.
-- Replaces the mobile app's dev-only setVerificationStatusDev as the real admin action.
create or replace function public.review_verification(
  target_user_id uuid,
  decision text,
  rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'invalid decision: %', decision;
  end if;

  insert into public.verification_reviews (user_id, reviewer_id, decision, reason, aadhaar_front_uri, aadhaar_back_uri, selfie_uri)
  select target_user_id, auth.uid(), decision, rejection_reason,
         vd.aadhaar_front_uri, vd.aadhaar_back_uri, vd.selfie_uri
  from public.verification_documents vd
  where vd.user_id = target_user_id;

  update public.profiles
  set verification_status = decision,
      verification_rejection_reason = case when decision = 'rejected' then rejection_reason else null end,
      verified = (decision = 'approved')
  where id = target_user_id;
end;
$$;

revoke all on function public.review_verification(uuid, text, text) from public;
grant execute on function public.review_verification(uuid, text, text) to authenticated;
