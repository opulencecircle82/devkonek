-- Contest-style submissions — paste into Supabase SQL Editor and run once.
--
-- Replaces the "written offer + price quote" flow with a "build a working demo,
-- submit the link + price" flow. Developers submit a live/demo link a client can
-- click and try; the final source code/deliverable is still handed over directly
-- by the developer after payment (same as contact info — no file storage here).
--
-- Reuses the existing offers table/RLS rather than a new table, to avoid
-- disturbing platform_fees, reviews, and reports which all key off offers.

alter table public.offers add column if not exists demo_link text;
