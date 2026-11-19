-- House Tracker database schema
-- Paste this whole file into Supabase > SQL Editor > New query, then click "Run".
-- It is safe to run more than once.
--
-- How sharing works:
--   * A "household" is the shared space. The first person creates it in the app.
--   * The app shows a 6-letter join code. The second person enters it to join.
--   * Row Level Security (RLS) makes every table and every photo visible ONLY
--     to members of that household. Nobody else who signs up can see your data.

-- ---------------------------------------------------------------------------
-- Households and members
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our house',
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create or replace function public.is_member(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists "members read household" on public.households;
create policy "members read household" on public.households
  for select using (public.is_member(id));

drop policy if exists "members rename household" on public.households;
create policy "members rename household" on public.households
  for update using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "members read members" on public.household_members;
create policy "members read members" on public.household_members
  for select using (user_id = auth.uid() or public.is_member(household_id));

drop policy if exists "update own member row" on public.household_members;
create policy "update own member row" on public.household_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- App data. Every row belongs to a household. Rows are "soft deleted"
-- (deleted = true) so deletions sync correctly between phones.
-- Ids are created on the phone so the app works offline.
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id uuid primary key,                       -- same as household_id
  household_id uuid not null unique references public.households(id) on delete cascade,
  categories jsonb not null default '["Labor","Cement & Materials","Electrical","Plumbing","Tiles","Windows & Doors","Painting","Other"]',
  worker_payday int not null default 6,      -- 0 = Sunday ... 6 = Saturday
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Supplier and worker payments are ALSO expenses (kind = supplier_payment /
-- worker_payment), so money is never entered twice.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'supplier_payment', 'worker_payment')),
  date date not null default current_date,
  amount numeric(14,3) not null check (amount >= 0),
  category text not null default 'Other',
  area_id uuid,
  paid_to text,
  note text,
  supplier_id uuid,
  worker_id uuid,
  work_item_id uuid,
  period text,                               -- 'YYYY-MM' for supplier, week start date for workers
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  total_debt numeric(14,3) not null default 0,       -- amount owed at setup
  monthly_payment numeric(14,3) not null default 0,
  interest_rate numeric(6,3) not null default 0,     -- optional, % per year
  window_start_day int not null default 22,
  window_end_day int not null default 25,
  start_month text,                                  -- 'YYYY-MM' of the first payment
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- New purchases on credit that increase the debt.
create table if not exists public.supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  supplier_id uuid not null,
  date date not null default current_date,
  amount numeric(14,3) not null check (amount >= 0),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  area_id uuid not null,
  title text not null,
  estimated_cost numeric(14,3) not null default 0,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  note text,
  sort int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  trade text,
  agreed_total numeric(14,3) not null default 0,
  weekly_payment numeric(14,3) not null default 0,
  start_date date,
  area_id uuid,
  phone text,
  active boolean not null default true,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Photos: receipts, task photos, area progress photos and documents.
-- The image itself lives in the private "photos" storage bucket at `path`.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('receipt', 'task', 'area', 'document')),
  ref_id uuid,                               -- expense id or work item id
  area_id uuid,
  title text,
  date date not null default current_date,
  path text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Same rule on every data table: only household members can read or write.
do $$
declare t text;
begin
  foreach t in array array['settings','areas','expenses','suppliers','supplier_purchases','work_items','workers','photos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "household members" on public.%I', t);
    execute format(
      'create policy "household members" on public.%I for all using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
    execute format('create index if not exists %I on public.%I (household_id)', t || '_household_idx', t);
  end loop;
end $$;

-- Live updates: when one phone saves, the other refreshes automatically.
do $$
declare t text;
begin
  foreach t in array array['settings','areas','expenses','suppliers','supplier_purchases','work_items','workers','photos']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Create / join a household
-- ---------------------------------------------------------------------------
create or replace function public.create_household(p_name text, p_display_name text)
returns public.households
language plpgsql security definer set search_path = public
as $$
declare
  h public.households;
  code text;
  area_name text;
  i int := 0;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;
  loop
    -- 6 characters, avoiding look-alikes such as 0/O and 1/I
    code := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 6));
    exit when length(code) = 6 and not exists (select 1 from households where join_code = code);
  end loop;
  insert into households (name, join_code)
    values (coalesce(nullif(trim(p_name), ''), 'Our house'), code)
    returning * into h;
  insert into household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), nullif(trim(p_display_name), ''));
  insert into settings (id, household_id) values (h.id, h.id);
  foreach area_name in array array['Ground floor','First floor','Second floor','Stair tower','Exterior','Roof']
  loop
    insert into areas (household_id, name, sort) values (h.id, area_name, i);
    i := i + 1;
  end loop;
  return h;
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into hid from households where join_code = upper(trim(p_code));
  if hid is null then raise exception 'That code was not found'; end if;
  if exists (select 1 from household_members where user_id = auth.uid() and household_id <> hid) then
    raise exception 'You already belong to another household';
  end if;
  if (select count(*) from household_members where household_id = hid) >= 2
     and not exists (select 1 from household_members where household_id = hid and user_id = auth.uid()) then
    raise exception 'This household already has two members';
  end if;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), nullif(trim(p_display_name), ''))
    on conflict (household_id, user_id) do nothing;
  return hid;
end;
$$;

revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage: private bucket, files stored under <household_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create or replace function public.photo_folder_ok(object_name text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
begin
  return public.is_member(((storage.foldername(object_name))[1])::uuid);
exception when others then
  return false;
end;
$$;

drop policy if exists "household photos read" on storage.objects;
create policy "household photos read" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and public.photo_folder_ok(name));

drop policy if exists "household photos insert" on storage.objects;
create policy "household photos insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and public.photo_folder_ok(name));

drop policy if exists "household photos update" on storage.objects;
create policy "household photos update" on storage.objects
  for update to authenticated using (bucket_id = 'photos' and public.photo_folder_ok(name));

drop policy if exists "household photos delete" on storage.objects;
create policy "household photos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and public.photo_folder_ok(name));
