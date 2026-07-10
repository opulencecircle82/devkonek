-- DevKonek schema — paste this whole file into Supabase SQL Editor and run once.

-- ============ TABLES ============

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('client', 'developer')),
  full_name text not null,
  business_name text,
  skills text[] default '{}',
  bio text,
  contact text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  project_type text not null check (project_type in ('website', 'mobile_app', 'both')),
  category text not null,
  budget_min integer not null default 0,
  budget_max integer not null default 0,
  timeline text,
  details text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  developer_id uuid not null references public.profiles(id) on delete cascade,
  price integer not null,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (project_id, developer_id)
);

-- ============ GRANTS (required — without these, client queries silently return empty) ============

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert, update on public.offers to authenticated;

-- ============ ROW LEVEL SECURITY ============

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.offers enable row level security;

-- Profiles: any logged-in user can view (needed to show names/skills on offers);
-- users can only create/update their own profile.
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Projects: jobs are public to logged-in users; only the owning client can create/update.
create policy "projects_select" on public.projects
  for select to authenticated using (true);
create policy "projects_insert" on public.projects
  for insert to authenticated with check (client_id = auth.uid());
create policy "projects_update" on public.projects
  for update to authenticated using (client_id = auth.uid());

-- Offers: visible to the developer who made it and the client who owns the project.
create policy "offers_select" on public.offers
  for select to authenticated using (
    developer_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = offers.project_id and p.client_id = auth.uid()
    )
  );
create policy "offers_insert" on public.offers
  for insert to authenticated with check (developer_id = auth.uid());
-- Developer can edit own pending offer; project owner can accept/decline.
create policy "offers_update" on public.offers
  for update to authenticated using (
    (developer_id = auth.uid() and status = 'pending')
    or exists (
      select 1 from public.projects p
      where p.id = offers.project_id and p.client_id = auth.uid()
    )
  );
