-- ============================================================================
-- Turfline — Supabase setup
-- Run this ONCE in the Supabase dashboard: SQL Editor -> New query -> paste ->
-- Run. Safe to run again later (everything is "if not exists" / "or replace").
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row holds the business details and the price list.
create table if not exists public.app_settings (
  id         int primary key default 1,
  business   jsonb not null default '{"name":"Yate Artificial Grass","vat":true}',
  rates      jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

create table if not exists public.crews (
  id         text primary key,
  name       text not null,
  colour     text not null default '#2C7A4B',
  sort       int  not null default 0,
  updated_at timestamptz not null default now()
);

-- Each lead is stored whole as JSON in `data`, matching the shape the app
-- already uses (name, stage, survey{}, quote{}, job{}, activity[] ...).
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create index if not exists leads_stage_idx    on public.leads ((data->>'stage'));
create index if not exists leads_jobstart_idx on public.leads ((data->'job'->>'startDate'));

-- Invoices, stored whole as JSON in `data` (number, date, billTo{}, description,
-- amount, vat flags, paid ...). Office only.
create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Maps a logged-in user to a role. Filled automatically by the trigger below.
create table if not exists public.profiles (
  id   uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'fitters' check (role in ('office','fitters'))
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The current user's role ('office', 'fitters', or 'none').
-- Prefers the profiles row; falls back to the login email so it still works
-- even if the new-user trigger below didn't fire.
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    (select case when email ilike 'office@%' then 'office' else 'fitters' end
       from auth.users where id = auth.uid()),
    'none');
$$;
grant execute on function public.app_role() to authenticated;

-- New auth users get a profile automatically.
--   office@...  -> office role      anything else -> fitters role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (new.id, case when new.email ilike 'office@%' then 'office' else 'fitters' end)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh on every write (used to order live updates).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists leads_touch    on public.leads;
drop trigger if exists crews_touch    on public.crews;
drop trigger if exists settings_touch on public.app_settings;
drop trigger if exists invoices_touch on public.invoices;
create trigger leads_touch    before update on public.leads       for each row execute function public.touch_updated_at();
create trigger crews_touch    before update on public.crews       for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();
create trigger invoices_touch before update on public.invoices     for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
--   office  : full read/write on everything
--   fitters : read crew names only; job data comes from get_job_sheets() below
-- ---------------------------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.crews        enable row level security;
alter table public.leads        enable row level security;
alter table public.invoices     enable row level security;
alter table public.profiles     enable row level security;

drop policy if exists office_settings   on public.app_settings;
drop policy if exists office_crews      on public.crews;
drop policy if exists fitters_read_crews on public.crews;
drop policy if exists office_leads      on public.leads;
drop policy if exists office_invoices   on public.invoices;
drop policy if exists own_profile       on public.profiles;

create policy office_settings on public.app_settings for all
  using (public.app_role() = 'office') with check (public.app_role() = 'office');

create policy office_crews on public.crews for all
  using (public.app_role() = 'office') with check (public.app_role() = 'office');

create policy fitters_read_crews on public.crews for select
  using (public.app_role() in ('office','fitters'));

create policy office_leads on public.leads for all
  using (public.app_role() = 'office') with check (public.app_role() = 'office');

create policy office_invoices on public.invoices for all
  using (public.app_role() = 'office') with check (public.app_role() = 'office');

create policy own_profile on public.profiles for select
  using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Fitters' job sheets: scheduled jobs only, and NO money
-- (security definer: reads past the leads policy, but only returns safe fields)
-- ---------------------------------------------------------------------------

create or replace function public.get_job_sheets()
returns table (id uuid, name text, address text, postcode text, phone text, survey jsonb, job jsonb)
language sql stable security definer set search_path = public as $$
  select
    l.id,
    l.data->>'name', l.data->>'address', l.data->>'postcode', l.data->>'phone',
    -- the survey minus any money: area, grass name, site notes and the works
    -- toggles (booleans, absent = included). extraCost / discount stripped out.
    (coalesce(l.data->'survey', '{}'::jsonb) - 'extraCost' - 'discount' - 'extraLabel'),
    jsonb_build_object(
      'crewId',      l.data->'job'->>'crewId',
      'startDate',   l.data->'job'->>'startDate',
      'days',        l.data->'job'->>'days',
      'status',      l.data->'job'->>'status',
      'completedAt', l.data->'job'->>'completedAt'
    )
  from public.leads l
  where coalesce(l.data->'job'->>'startDate', '') <> ''
    and public.app_role() in ('office', 'fitters');
$$;
grant execute on function public.get_job_sheets() to authenticated;

-- Fitters (and office) can mark a job complete without touching anything else.
create or replace function public.mark_job_complete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d     jsonb;
  today text := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  stamp text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if public.app_role() not in ('office', 'fitters') then
    raise exception 'not authorised';
  end if;
  select data into d from public.leads where id = p_id;
  if d is null then raise exception 'no such job'; end if;

  d := jsonb_set(d, '{job}',
        coalesce(d->'job', '{}'::jsonb) || jsonb_build_object('status', 'complete', 'completedAt', today));
  if d->>'stage' = 'won' then
    d := jsonb_set(d, '{stage}',   '"installed"');
    d := jsonb_set(d, '{stageAt}', to_jsonb(today));
  end if;
  d := jsonb_set(d, '{activity}',
        coalesce(d->'activity', '[]'::jsonb) || jsonb_build_object('ts', stamp, 'text', 'Install marked complete'));

  update public.leads set data = d where id = p_id;
end; $$;
grant execute on function public.mark_job_complete(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates (office devices stay in sync)
-- ---------------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.leads;        exception when others then null; end;
  begin alter publication supabase_realtime add table public.crews;        exception when others then null; end;
  begin alter publication supabase_realtime add table public.app_settings; exception when others then null; end;
  begin alter publication supabase_realtime add table public.invoices;     exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- Starting data (business settings + two crews; no sample leads)
-- ---------------------------------------------------------------------------
insert into public.app_settings (id, business, rates) values (
  1,
  '{"name":"Yate Artificial Grass","vat":true,"legalName":"Yate Artificial Grass Ltd",
    "bankName":"Lloyds Bank","sortCode":"30-99-50","accountNo":"56818060","vatNo":"460380900",
    "invoiceTerms":"PAYMENT DUE ON RECEIPT OF INVOICE","invoiceFoot":"OR CASH + CHEQUE ACCEPTED","nextInvoiceNo":261}',
  '{"grasses":[{"name":"Standard 30mm","rate":12.0}],
    "wastePct":10,"type1":6.0,"stoneDust":2.25,"muckaway":4.25,"membrane":0.45,"sand":0.96,"joins":0.25,"edging":2.6,
    "labour":10.5,"vans":0.66,"sundries":1.5,"marginPct":40,"vatPct":20,"m2PerCrewDay":40,
    "type1Depth":75,"stoneDustDepth":25}'
) on conflict (id) do nothing;

insert into public.crews (id, name, colour, sort) values
  ('c1', 'Crew A', '#2C7A4B', 0),
  ('c2', 'Crew B', '#7A5C2E', 1)
on conflict (id) do nothing;

-- Done. Next: create the two logins (see SUPABASE-SETUP.md).
