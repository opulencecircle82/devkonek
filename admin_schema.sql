-- Admin panel migration — paste into Supabase SQL Editor and run once (after schema.sql).

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Admins can see every offer (regular users only see their own — see schema.sql "offers_select")
create policy "offers_admin_select" on public.offers
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- Admins can update any project (e.g. cancel a disputed project)
create policy "projects_admin_update" on public.projects
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- Admins can update any offer (e.g. resolve a dispute)
create policy "offers_admin_update" on public.offers
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );
