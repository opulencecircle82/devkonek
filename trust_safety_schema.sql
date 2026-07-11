-- Trust & Safety migration — paste into Supabase SQL Editor and run once
-- (after schema.sql + admin_schema.sql + reviews_schema.sql).

-- ============ SUSPEND / BAN ============

alter table public.profiles add column if not exists is_banned boolean not null default false;

-- Banned users can no longer post new projects or send new offers,
-- even if they bypass the frontend and call the API directly.
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert to authenticated with check (
    client_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned = true)
  );

drop policy if exists "offers_insert" on public.offers;
create policy "offers_insert" on public.offers
  for insert to authenticated with check (
    developer_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned = true)
  );

-- Admins can toggle is_banned on any profile.
create policy "profiles_admin_update" on public.profiles
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- ============ REPORTS ============

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

grant select, insert on public.reports to authenticated;
grant update on public.reports to authenticated;

alter table public.reports enable row level security;

-- You can only report someone you were actually matched with on a project
-- (as the client, or as the developer whose offer was accepted).
create policy "reports_insert" on public.reports
  for insert to authenticated with check (
    reporter_id = auth.uid()
    and reported_id <> auth.uid()
    and exists (
      select 1
      from public.projects p
      join public.offers o on o.project_id = p.id and o.status = 'accepted'
      where p.id = reports.project_id
        and (
          (p.client_id = auth.uid() and o.developer_id = reports.reported_id)
          or
          (o.developer_id = auth.uid() and p.client_id = reports.reported_id)
        )
    )
  );

-- You can see the reports you filed; admins can see and update all reports.
create policy "reports_select_own" on public.reports
  for select to authenticated using (reporter_id = auth.uid());

create policy "reports_select_admin" on public.reports
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "reports_admin_update" on public.reports
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );
