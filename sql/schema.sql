-- ============================================================
--  Quantomize — Supabase SQL Schema
--  Run this in: Supabase → SQL Editor → New Query
-- ============================================================

create extension if not exists "uuid-ossp";

drop table if exists sale_items     cascade;
drop table if exists sales          cascade;
drop table if exists inventory_log  cascade;
drop table if exists products       cascade;
drop table if exists categories     cascade;
drop table if exists settings       cascade;
drop table if exists profiles       cascade;
drop function if exists next_receipt_no()   cascade;
drop function if exists update_updated_at() cascade;
drop function if exists handle_new_user()   cascade;

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  full_name  text not null,
  role       text not null default 'staff' check (role in ('admin','staff')),
  active     boolean not null default true,
  created_at timestamptz default now()
);

create table categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz default now()
);

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

create table settings (
  key   text primary key,
  value text
);

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

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles      enable row level security;
alter table categories    enable row level security;
alter table products      enable row level security;
alter table sales         enable row level security;
alter table sale_items    enable row level security;
alter table inventory_log enable row level security;
alter table settings      enable row level security;

create policy "read profiles"      on profiles      for select using (auth.role() = 'authenticated');
create policy "read categories"    on categories    for select using (auth.role() = 'authenticated');
create policy "read products"      on products      for select using (auth.role() = 'authenticated');
create policy "read sales"         on sales         for select using (auth.role() = 'authenticated');
create policy "read sale_items"    on sale_items    for select using (auth.role() = 'authenticated');
create policy "read inv_log"       on inventory_log for select using (auth.role() = 'authenticated');
create policy "read settings"      on settings      for select using (auth.role() = 'authenticated');
create policy "service profiles"   on profiles      for all using (true);
create policy "service categories" on categories    for all using (true);
create policy "service products"   on products      for all using (true);
create policy "service sales"      on sales         for all using (true);
create policy "service sale_items" on sale_items    for all using (true);
create policy "service inv_log"    on inventory_log for all using (true);
create policy "service settings"   on settings      for all using (true);

insert into settings (key, value) values
  ('store_name',      'Quantomize'),
  ('store_address',   ''),
  ('store_phone',     ''),
  ('currency_symbol', '₱'),
  ('receipt_prefix',  'RCP'),
  ('receipt_counter', '1'),
  ('tax_rate',        '0')
on conflict (key) do update set value = excluded.value;

insert into categories (name) values
  ('Food & Beverage'),
  ('Electronics'),
  ('Clothing'),
  ('Health & Beauty'),
  ('Home & Living')
on conflict (name) do nothing;

select 'Quantomize schema created successfully!' as status;
