-- 011_soft_delete_and_retention.sql
--
-- Replaces hard-delete of events with a soft delete + retention window, so a
-- deleted/expired event stays queryable by admins for a security/audit grace
-- period instead of being destroyed (and cascading away join_requests,
-- messages, notifications, ratings) the instant a creator cancels a plan.
--
-- Retention model (purge is manual — no automated job is wired up here):
--   - Manually deleted (deleted_at set): invisible to regular users
--     immediately; admin-queryable; eligible for manual purge after 72h.
--   - Naturally completed (date_time passed): stays normally visible for 48h,
--     then admin-only visible for a further 72h (120h total); eligible for
--     manual purge after that.
--
-- Manual purge reference query (run by a human/admin tool when ready):
--   delete from public.events
--   where (deleted_at is not null and deleted_at < now() - interval '72 hours')
--      or (deleted_at is null and date_time < now() - interval '120 hours');

-- 1. Soft-delete flag
alter table public.events add column deleted_at timestamptz;
create index idx_events_deleted_at on public.events (deleted_at) where deleted_at is not null;

-- 2. Visibility: admins see everything; everyone else only sees events that
--    aren't soft-deleted and completed less than 48h ago.
drop policy "events_select_all" on public.events;
create policy "events_select_all" on public.events for select
  using (
    public.is_admin()
    or (deleted_at is null and date_time >= now() - interval '48 hours')
  );

-- 3. Hard DELETE becomes admin-only (manual purge path). Creators now
--    soft-delete via UPDATE — events_update_creator already permits this,
--    no new policy needed for that direction.
drop policy "events_delete_creator" on public.events;
create policy "events_delete_admin_only" on public.events for delete
  using (public.is_admin());

-- 4. No new join requests once an event's date_time has passed.
drop policy "join_requests_insert_own" on public.join_requests;
create policy "join_requests_insert_own" on public.join_requests for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from events where id = event_id and date_time > now())
  );

-- 5. Admins keep full visibility into requests/chat during the retention
--    window (needed to actually investigate a complaint, not just see the
--    bare event row).
drop policy "join_requests_select_own" on public.join_requests;
create policy "join_requests_select_own" on public.join_requests for select
  using (
    auth.uid() = user_id
    or exists (select 1 from events where id = event_id and creator_id = auth.uid())
    or public.is_admin()
  );

drop policy "messages_select_approved" on public.messages;
create policy "messages_select_approved" on public.messages for select
  using (
    public.is_admin()
    or exists (
      select 1 from events e left join join_requests jr on e.id = jr.event_id
      where e.id = messages.event_id
      and (e.creator_id = auth.uid() or (jr.user_id = auth.uid() and jr.status = 'approved'))
    )
  );
