-- Platform fee migration — paste into Supabase SQL Editor and run once
-- (after schema.sql + admin_schema.sql + reviews_schema.sql + trust_safety_schema.sql).
--
-- DevKonek does not have a payment gateway (no backend server), so this is a
-- LEDGER, not automatic deduction: an 8% fee row is created automatically the
-- moment a client marks a project "completed". Developers settle it manually
-- (e.g. GCash) and an admin marks it "paid" once received.

create table if not exists public.platform_fees (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade unique,
  developer_id uuid not null references public.profiles(id) on delete cascade,
  offer_price integer not null,
  fee_amount integer not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

grant select, update on public.platform_fees to authenticated;

alter table public.platform_fees enable row level security;

create policy "platform_fees_select_own" on public.platform_fees
  for select to authenticated using (developer_id = auth.uid());

create policy "platform_fees_select_admin" on public.platform_fees
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "platform_fees_admin_update" on public.platform_fees
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- Auto-create the fee row the instant a project flips to 'completed'.
-- SECURITY DEFINER so it bypasses RLS regardless of who (client) triggered the update.
create or replace function public.create_platform_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_developer_id uuid;
  v_price integer;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    select o.developer_id, o.price into v_developer_id, v_price
    from public.offers o
    where o.project_id = new.id and o.status = 'accepted'
    limit 1;

    if v_developer_id is not null then
      insert into public.platform_fees (project_id, developer_id, offer_price, fee_amount)
      values (new.id, v_developer_id, v_price, round(v_price * 0.08))
      on conflict (project_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_platform_fee on public.projects;
create trigger trg_create_platform_fee
  after update on public.projects
  for each row
  execute function public.create_platform_fee();
