-- ============================================================
--  Quantomize — Supabase SQL Schema (Safe Version)
--  Run this in: Supabase → SQL Editor → New Query
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Drop existing tables safely ───────────────────────────────
drop table if exists sale_items cascade;
drop table if exists sales cascade;
drop table if exists inventory_log cascade;
drop table if exists products cascade;
drop table if exists categories cascade;
drop table if exists settings cascade;
drop table if exists profiles cascade;

-- ── Drop existing policies safely ─────────────────────────────
drop policy if exists "Auth read profiles"      on profiles;
drop policy if exists "Auth read categories"    on categories;
drop policy if exists "Auth read products"      on products;
drop policy if exists "Auth read sales"         on sales;
drop policy if exists "Auth read sale_items"    on sale_items;
drop policy if exists "Auth read inv_log"       on inventory_log;
drop policy if exists "Auth read settings"      on settings;
drop policy if exists "Service full profiles"   on profiles;
drop policy if exists "Service full categories" on categories;
drop policy if exists "Service full products"   on products;
drop policy if exists "Service full sales"      on sales;
drop policy if exists "Service full sale_items" on sale_items;
drop policy if exists "Service full inv_log"    on inventory_log;
drop policy if exists "Service full settings"   on settings;

-- ── Profiles ─────────────────────────────────────────────────
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  full_name  text not null,
  role       text not null default 'staff' check (role in ('admin','staff')),
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- ── Categories ───────────────────────────────────────────────
create table categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz default now()
);

-- ── Products ─────────────────────────────────────────────────
create table products (
  id              uuid primary key default uuid_generate_v4(),
  sku             text unique,
  name            text not null,
  category_id     uuid references categories(id) on delete set null,
  cost_price      numeric(12,2) not null default 0,
  selling_price   numeric(12,2) not null,
  stock           integer not null default 0,
  unit            text not null default 'pcs',
  low_stock_alert integer not null default 5,
  barcode         text,
  active          boolean not null default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Sales ────────────────────────────────────────────────────
create table sales (
  id             uuid primary key default uuid_generate_v4(),
  receipt_no     text unique not null,
  user_id        uuid references profiles(id),
  username       text,
  subtotal       numeric(12,2) not null,
  discount       numeric(12,2) not null default 0,
  tax            numeric(12,2) not null default 0,
  total          numeric(12,2) not null,
  payment_method text not null default 'cash',
  customer_name  text,
  notes          text,
  status         text not null default 'completed' check (status in ('completed','voided')),
  created_at     timestamptz default now()
);

-- ── Sale Items ───────────────────────────────────────────────
create table sale_items (
  id           uuid primary key default uuid_generate_v4(),
  sale_id      uuid not null references sales(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  product_name text not null,
  qty          integer not null,
  price        numeric(12,2) not null,
  cost         numeric(12,2) not null default 0,
  line_total   numeric(12,2) not null
);

-- ── Inventory Log ────────────────────────────────────────────
create table inventory_log (
  id           uuid primary key default uuid_generate_v4(),
  product_id   uuid references products(id) on delete set null,
  product_name text not null,
  type         text not null check (type in ('INITIAL','ADD','REMOVE','SALE','VOID')),
  qty          integer not null,
  prev_stock   integer,
  reason       text,
  created_by   text,
  created_at   timestamptz default now()
);

-- ── Settings ─────────────────────────────────────────────────
create table settings (
  key   text primary key,
  value text
);

-- ── Receipt number function ───────────────────────────────────
create or replace function next_receipt_no()
returns text language plpgsql as $$
declare
  prefix  text;
  counter int;
begin
  select value into prefix  from settings where key = 'receipt_prefix';
  select value into counter from settings where key = 'receipt_counter';
  prefix  := coalesce(prefix, 'RCP');
  counter := coalesce(counter, 1);
  update settings set value = (counter + 1)::text where key = 'receipt_counter';
  return prefix || '-' || lpad(counter::text, 6, '0');
end;
$$;

-- ── Updated_at trigger ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

-- ── Auto-create profile on signup ────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Row Level Security ───────────────────────────────────────
alter table profiles      enable row level security;
alter table categories    enable row level security;
alter table products      enable row level security;
alter table sales         enable row level security;
alter table sale_items    enable row level security;
alter table inventory_log enable row level security;
alter table settings      enable row level security;

-- Authenticated users can read everything
create policy "Auth read profiles"   on profiles      for select using (auth.role() = 'authenticated');
create policy "Auth read categories" on categories    for select using (auth.role() = 'authenticated');
create policy "Auth read products"   on products      for select using (auth.role() = 'authenticated');
create policy "Auth read sales"      on sales         for select using (auth.role() = 'authenticated');
create policy "Auth read sale_items" on sale_items    for select using (auth.role() = 'authenticated');
create policy "Auth read inv_log"    on inventory_log for select using (auth.role() = 'authenticated');
create policy "Auth read settings"   on settings      for select using (auth.role() = 'authenticated');

-- Service role has full access (used by Vercel API)
create policy "Service full profiles"   on profiles      for all using (true);
create policy "Service full categories" on categories    for all using (true);
create policy "Service full products"   on products      for all using (true);
create policy "Service full sales"      on sales         for all using (true);
create policy "Service full sale_items" on sale_items    for all using (true);
create policy "Service full inv_log"    on inventory_log for all using (true);
create policy "Service full settings"   on settings      for all using (true);

-- ── Default settings ─────────────────────────────────────────
insert into settings (key, value) values
  ('store_name',      'Quantomize'),
  ('store_address',   ''),
  ('store_phone',     ''),
  ('currency_symbol', '₱'),
  ('receipt_prefix',  'RCP'),
  ('receipt_counter', '1'),
  ('tax_rate',        '0')
on conflict (key) do update set value = excluded.value;

-- ── Default categories ───────────────────────────────────────
insert into categories (name) values
  ('Food & Beverage'),
  ('Electronics'),
  ('Clothing'),
  ('Health & Beauty'),
  ('Home & Living')
on conflict (name) do nothing;

-- ── Make existing auth user an admin ─────────────────────────
-- Run this separately after creating your user in Auth → Users:
-- UPDATE profiles SET role = 'admin', username = 'admin', full_name = 'Administrator'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');

select 'Quantomize schema created successfully!' as status;
