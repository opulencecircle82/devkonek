-- Payment info migration — paste into Supabase SQL Editor and run once.
--
-- Deliberately does NOT include a full bank account number field — only safe,
-- low-risk identifiers (PayPal email, GCash number, bank + account name for
-- reference). Full account numbers should be exchanged directly between the
-- matched client and developer via their own contact channel, never stored here.
-- No RLS changes needed: profiles is already select-all / update-own.

alter table public.profiles add column if not exists paypal_email text;
alter table public.profiles add column if not exists gcash_number text;
alter table public.profiles add column if not exists bank_name text;
alter table public.profiles add column if not exists bank_account_name text;
