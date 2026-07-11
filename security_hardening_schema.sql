-- Security hardening migration — paste into Supabase SQL Editor and run once
-- (after schema.sql, admin_schema.sql, trust_safety_schema.sql, payment_info_schema.sql).
--
-- Problem: profiles_select currently uses `using (true)`, meaning ANY logged-in
-- user (even a brand-new account with zero interactions) can call
-- `db.from('profiles').select('*')` directly from the browser console and dump
-- every user's contact info AND payment identifiers (paypal_email, gcash_number,
-- bank_name, bank_account_name) — not just the people they've actually dealt with.
-- The app's UI only *displays* those fields after a match, but RLS never enforced
-- that; it was a client-side-only gate.
--
-- Fix: split "browsable public info" from "private info".
--  1. A public_profiles VIEW exposes only safe, non-sensitive fields to everyone
--     (needed so job/developer browsing still works before any relationship exists).
--  2. The base profiles table's SELECT policy is tightened to: your own row, an
--     admin, or someone you have an actual project/offer relationship with.
--
-- The admin check must go through a SECURITY DEFINER function, not an inline
-- subquery on profiles — a policy on profiles that subqueries profiles directly
-- triggers "infinite recursion detected in policy for relation profiles" in
-- Postgres. The function runs as its (RLS-bypassing) owner, so the internal
-- lookup never re-triggers this same policy.

-- ============ 1. PUBLIC-SAFE VIEW ============

create or replace view public.public_profiles as
select id, role, full_name, business_name, skills, bio, created_at
from public.profiles;

grant select on public.public_profiles to authenticated;

-- ============ 2. is_admin() HELPER (avoids RLS self-recursion) ============

create or replace function public.is_admin() returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- ============ 3. TIGHTEN profiles_select ============

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.projects pr
      join public.offers o on o.project_id = pr.id
      where (pr.client_id = auth.uid() and o.developer_id = profiles.id)
         or (o.developer_id = auth.uid() and pr.client_id = profiles.id)
    )
  );
