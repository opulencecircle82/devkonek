-- Reviews migration — paste into Supabase SQL Editor and run once (after schema.sql + admin_schema.sql).

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, reviewer_id)
);

grant select, insert on public.reviews to authenticated;

alter table public.reviews enable row level security;

-- Reviews are public (like Upwork) — anyone logged in can see them to judge reputation.
create policy "reviews_select" on public.reviews
  for select to authenticated using (true);

-- You can only review someone you actually completed a matched project with,
-- and only in the correct direction (client <-> the developer whose offer was accepted).
create policy "reviews_insert" on public.reviews
  for insert to authenticated with check (
    reviewer_id = auth.uid()
    and reviewee_id <> auth.uid()
    and exists (
      select 1
      from public.projects p
      join public.offers o on o.project_id = p.id and o.status = 'accepted'
      where p.id = reviews.project_id
        and p.status = 'completed'
        and (
          (p.client_id = auth.uid() and o.developer_id = reviews.reviewee_id)
          or
          (o.developer_id = auth.uid() and p.client_id = reviews.reviewee_id)
        )
    )
  );
