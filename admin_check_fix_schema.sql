-- Fixes the remaining "infinite recursion detected in policy for relation profiles"
-- error. security_hardening_schema.sql fixed profiles_select's OWN admin check, but
-- missed that profiles_select also joins projects + offers (for the "you have a
-- relationship with this person" check) — and offers_admin_select (from
-- admin_schema.sql) still inline-subqueried profiles directly. So the cycle was:
-- profiles_select -> (joins offers) -> offers_admin_select -> queries profiles again
-- -> profiles_select ... forever.
--
-- Fix: every admin-check policy across the schema now calls public.is_admin()
-- (the SECURITY DEFINER helper from security_hardening_schema.sql) instead of
-- inline-subquerying profiles, so none of them re-trigger profiles_select.
-- Run this AFTER security_hardening_schema.sql.

drop policy if exists "offers_admin_select" on public.offers;
create policy "offers_admin_select" on public.offers
  for select to authenticated using (public.is_admin());

drop policy if exists "projects_admin_update" on public.projects;
create policy "projects_admin_update" on public.projects
  for update to authenticated using (public.is_admin());

drop policy if exists "offers_admin_update" on public.offers;
create policy "offers_admin_update" on public.offers
  for update to authenticated using (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated using (public.is_admin());

drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin" on public.reports
  for select to authenticated using (public.is_admin());

drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports
  for update to authenticated using (public.is_admin());

drop policy if exists "platform_fees_select_admin" on public.platform_fees;
create policy "platform_fees_select_admin" on public.platform_fees
  for select to authenticated using (public.is_admin());

drop policy if exists "platform_fees_admin_update" on public.platform_fees;
create policy "platform_fees_admin_update" on public.platform_fees
  for update to authenticated using (public.is_admin());
