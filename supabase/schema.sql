-- Srez household schema (Supabase / Postgres)

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nick text not null unique,
  name text not null,
  email text not null,
  household_id uuid,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_slug text not null unique,
  cash_on_hand numeric not null default 0,
  savings_balance numeric not null default 0,
  savings_rate numeric not null default 0,
  savings_cap text not null default 'm',
  savings_goal numeric not null default 100000,
  incomes jsonb not null default '[]'::jsonb,
  obligations jsonb not null default '[]'::jsonb,
  transactions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_household_id_fkey
  foreign key (household_id) references public.households (id) on delete set null;

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  primary key (household_id, user_id)
);

create index profiles_nick_idx on public.profiles (nick);
create index households_slug_idx on public.households (invite_slug);

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

create or replace function public.is_household_member(hh uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = auth.uid()
  );
$$;

create policy "profiles read self or household mate"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );

create policy "profiles update self"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles insert self"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "households select member"
  on public.households for select to authenticated
  using (public.is_household_member(id));

create policy "households update member"
  on public.households for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

create policy "households insert authenticated"
  on public.households for insert to authenticated
  with check (true);

create policy "members select same household"
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

create policy "members insert owner-or-self-bootstrap"
  on public.household_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_household_member(household_id)
  );

create policy "members delete member"
  on public.household_members for delete to authenticated
  using (public.is_household_member(household_id));

-- Resolve email by nick or email for login (returns only email)
create or replace function public.resolve_login_email(login text)
returns text
language sql
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.nick = lower(regexp_replace(trim(login), '^@', ''))
     or lower(p.email) = lower(trim(login))
  limit 1;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Register: create empty household + profile for new auth user
create or replace function public.register_profile(
  p_nick text,
  p_name text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nick text := lower(regexp_replace(trim(p_nick), '^@', ''));
  v_hh uuid;
  v_slug text;
  v_payload jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if length(v_nick) < 2 then
    raise exception 'nick too short';
  end if;
  if exists (select 1 from profiles where nick = v_nick) then
    raise exception 'nick taken';
  end if;
  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'profile exists';
  end if;

  v_slug := v_nick || '-budget';
  if exists (select 1 from households where invite_slug = v_slug) then
    v_slug := v_nick || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into households (invite_slug)
  values (v_slug)
  returning id into v_hh;

  insert into profiles (id, nick, name, email, household_id)
  values (v_uid, v_nick, coalesce(nullif(trim(p_name), ''), v_nick), lower(trim(p_email)), v_hh);

  insert into household_members (household_id, user_id, role)
  values (v_hh, v_uid, 'owner');

  select jsonb_build_object(
    'id', h.id,
    'inviteSlug', h.invite_slug,
    'cashOnHand', h.cash_on_hand,
    'savingsBalance', h.savings_balance,
    'savingsRate', h.savings_rate,
    'savingsCap', h.savings_cap,
    'savingsGoal', h.savings_goal,
    'incomes', h.incomes,
    'obligations', h.obligations,
    'transactions', h.transactions,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'nick', p.nick,
        'role', m.role
      ) order by m.role), '[]'::jsonb)
      from household_members m
      join profiles p on p.id = m.user_id
      where m.household_id = h.id
    )
  )
  into v_payload
  from households h
  where h.id = v_hh;

  return v_payload;
end;
$$;

grant execute on function public.register_profile(text, text, text) to authenticated;

create or replace function public.get_my_household()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hh uuid;
  v_payload jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select household_id into v_hh from profiles where id = v_uid;
  if v_hh is null then
    return null;
  end if;
  select jsonb_build_object(
    'id', h.id,
    'inviteSlug', h.invite_slug,
    'cashOnHand', h.cash_on_hand,
    'savingsBalance', h.savings_balance,
    'savingsRate', h.savings_rate,
    'savingsCap', h.savings_cap,
    'savingsGoal', h.savings_goal,
    'incomes', h.incomes,
    'obligations', h.obligations,
    'transactions', h.transactions,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'nick', p.nick,
        'role', m.role
      ) order by m.role), '[]'::jsonb)
      from household_members m
      join profiles p on p.id = m.user_id
      where m.household_id = h.id
    )
  )
  into v_payload
  from households h
  where h.id = v_hh;
  return v_payload;
end;
$$;

grant execute on function public.get_my_household() to authenticated;

create or replace function public.put_household(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hh uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select household_id into v_hh from profiles where id = v_uid;
  if v_hh is null or not public.is_household_member(v_hh) then
    raise exception 'no access';
  end if;
  if (payload->>'id') is distinct from v_hh::text then
    raise exception 'household mismatch';
  end if;

  update households set
    cash_on_hand = coalesce((payload->>'cashOnHand')::numeric, cash_on_hand),
    savings_balance = coalesce((payload->>'savingsBalance')::numeric, savings_balance),
    savings_rate = coalesce((payload->>'savingsRate')::numeric, savings_rate),
    savings_cap = coalesce(payload->>'savingsCap', savings_cap),
    savings_goal = coalesce((payload->>'savingsGoal')::numeric, savings_goal),
    incomes = coalesce(payload->'incomes', incomes),
    obligations = coalesce(payload->'obligations', obligations),
    transactions = coalesce(payload->'transactions', transactions),
    updated_at = now()
  where id = v_hh;

  return public.get_my_household();
end;
$$;

grant execute on function public.put_household(jsonb) to authenticated;

create or replace function public.invite_by_nick(p_nick text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hh uuid;
  v_nick text := lower(regexp_replace(trim(p_nick), '^@', ''));
  v_target profiles%rowtype;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select household_id into v_hh from profiles where id = v_uid;
  if v_hh is null then
    raise exception 'no household';
  end if;
  if not public.is_household_member(v_hh) then
    raise exception 'no access';
  end if;
  select count(*) into v_count from household_members where household_id = v_hh;
  if v_count >= 2 then
    raise exception 'household full';
  end if;
  select * into v_target from profiles where nick = v_nick;
  if not found then
    raise exception 'user not found';
  end if;
  if exists (select 1 from household_members where household_id = v_hh and user_id = v_target.id) then
    raise exception 'already member';
  end if;

  -- leave solo household if any
  if v_target.household_id is not null and v_target.household_id <> v_hh then
    select count(*) into v_count from household_members where household_id = v_target.household_id;
    if v_count = 1 then
      delete from households where id = v_target.household_id;
    else
      delete from household_members where household_id = v_target.household_id and user_id = v_target.id;
    end if;
  end if;

  insert into household_members (household_id, user_id, role)
  values (v_hh, v_target.id, 'member');

  update profiles set household_id = v_hh where id = v_target.id;

  return public.get_my_household();
end;
$$;

grant execute on function public.invite_by_nick(text) to authenticated;

create or replace function public.join_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hh uuid;
  v_old uuid;
  v_count int;
  v_slug text := lower(trim(p_slug));
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select id into v_hh from households where invite_slug = v_slug;
  if v_hh is null then
    raise exception 'invalid invite';
  end if;
  if exists (select 1 from household_members where household_id = v_hh and user_id = v_uid) then
    return public.get_my_household();
  end if;
  select count(*) into v_count from household_members where household_id = v_hh;
  if v_count >= 2 then
    raise exception 'household full';
  end if;

  select household_id into v_old from profiles where id = v_uid;
  if v_old is not null and v_old <> v_hh then
    select count(*) into v_count from household_members where household_id = v_old;
    if v_count = 1 then
      delete from households where id = v_old;
    else
      delete from household_members where household_id = v_old and user_id = v_uid;
    end if;
  end if;

  insert into household_members (household_id, user_id, role)
  values (v_hh, v_uid, 'member');
  update profiles set household_id = v_hh where id = v_uid;

  return public.get_my_household();
end;
$$;

grant execute on function public.join_by_slug(text) to authenticated;
