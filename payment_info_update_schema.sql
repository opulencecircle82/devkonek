-- Payment info update — paste into Supabase SQL Editor and run once
-- (after payment_info_schema.sql). Safe to run even if payment_info_schema.sql
-- was already applied.
--
-- Drops GCash (removed from the app) and adds a SWIFT/BIC code field for
-- international bank transfers. SWIFT/BIC codes are public bank-routing
-- identifiers, not secret account numbers, so they're safe to store here.

alter table public.profiles drop column if exists gcash_number;
alter table public.profiles add column if not exists swift_code text;
