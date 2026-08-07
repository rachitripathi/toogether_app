-- Toogether App - Verification Status & Documents
-- Version: 1.0
-- Why: Verification used to be a single instant boolean toggle (`profiles.verified`).
-- The new flow captures Aadhaar front/back + a liveness selfie, uploads them to
-- Cloudinary, and holds the account in a real "pending" state until it's approved
-- or rejected (manually, for now — there's no automated review pipeline yet).
-- `verified` itself is left untouched (it already drives the join-request bonus
-- elsewhere) and is kept in sync with `verification_status = 'approved'` by the app.
-- Safe to re-run: every column add is idempotent.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aadhaar_front_uri TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aadhaar_back_uri TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_uri TEXT;

-- Backfill: accounts that were already verified under the old instant-toggle flow
-- should read as "approved", not "unverified", under the new status field.
UPDATE public.profiles
SET verification_status = 'approved'
WHERE verified = true AND (verification_status IS NULL OR verification_status = 'unverified');

CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(verification_status);
