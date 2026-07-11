-- Adds a full bank account number field — paste into Supabase SQL Editor and run once.
--
-- NOTE: this reverses an earlier deliberate decision to exclude account numbers
-- (see payment_info_schema.sql). Storing this is a real risk: if the database is
-- ever breached, real account numbers leak, unlike bank name/SWIFT which are
-- already-public identifiers. It's protected by the same RLS as the rest of
-- profiles (only visible to the profile owner, an admin, or a matched
-- client/developer), but a future RLS bug (like the one just fixed) could
-- re-expose it. Proceeding anyway per explicit request.

alter table public.profiles add column if not exists bank_account_number text;
