-- Backs the OTP-based forgot-password flow (together-admin's
-- app/api/forgot-password/send-otp and verify-otp route handlers).
-- No RLS policies, by design: only the service-role key (together-admin)
-- ever touches this table, same pattern as public.admin_users in 007.
create table public.password_reset_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_password_reset_otps_email on public.password_reset_otps(email);

alter table public.password_reset_otps enable row level security;
