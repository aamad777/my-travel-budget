
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles: select own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles: update own" on public.profiles for update using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- trips
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  destination text,
  start_date date,
  end_date date,
  budget_amount numeric(14,2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.trips enable row level security;
create policy "Trips: select own" on public.trips for select using (auth.uid() = user_id);
create policy "Trips: insert own" on public.trips for insert with check (auth.uid() = user_id);
create policy "Trips: update own" on public.trips for update using (auth.uid() = user_id);
create policy "Trips: delete own" on public.trips for delete using (auth.uid() = user_id);
create index trips_user_id_idx on public.trips(user_id);

-- categories (presets when user_id is null)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'Tag',
  color text not null default '#5cbdb9',
  is_preset boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "Categories: select presets or own" on public.categories for select using (is_preset or auth.uid() = user_id);
create policy "Categories: insert own" on public.categories for insert with check (auth.uid() = user_id and not is_preset);
create policy "Categories: update own" on public.categories for update using (auth.uid() = user_id and not is_preset);
create policy "Categories: delete own" on public.categories for delete using (auth.uid() = user_id and not is_preset);

insert into public.categories (name, icon, color, is_preset) values
  ('Food', 'Utensils', '#f59e0b', true),
  ('Transport', 'Car', '#3b82f6', true),
  ('Lodging', 'BedDouble', '#8b5cf6', true),
  ('Activities', 'Ticket', '#ec4899', true),
  ('Shopping', 'ShoppingBag', '#10b981', true),
  ('Other', 'Tag', '#94a3b8', true);

-- expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text not null,
  fx_rate_to_trip numeric(18,8) not null default 1,
  amount_in_trip_currency numeric(14,2) not null,
  category_id uuid references public.categories(id) on delete set null,
  note text,
  spent_at timestamptz not null default now(),
  kind text not null default 'expense' check (kind in ('expense','income')),
  created_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
create policy "Expenses: select own" on public.expenses for select using (auth.uid() = user_id);
create policy "Expenses: insert own" on public.expenses for insert with check (auth.uid() = user_id);
create policy "Expenses: update own" on public.expenses for update using (auth.uid() = user_id);
create policy "Expenses: delete own" on public.expenses for delete using (auth.uid() = user_id);
create index expenses_trip_id_idx on public.expenses(trip_id);
create index expenses_user_id_idx on public.expenses(user_id);

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trips_updated_at before update on public.trips for each row execute function public.set_updated_at();
