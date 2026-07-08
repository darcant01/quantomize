-- ============================================================
--  Quantomize SaaS — Multi-Tenant Migration
--  Run in: Supabase → SQL Editor → New Query
--  ⚠️ This rebuilds tables. Existing data will be dropped.
-- ============================================================

create extension if not exists "uuid-ossp";

drop table if exists sale_items     cascade;
drop table if exists sales          cascade;
drop table if exists inventory_log  cascade;
drop table if exists products       cascade;
drop table if exists categories     cascade;
drop table if exists settings       cascade;
drop table if exists profiles       cascade;
drop table if exists stores         cascade;
drop function if exists next_receipt_no(uuid) cascade;
drop function if exists next_receipt_no()     cascade;
drop function if exists update_updated_at()   cascade;
drop function if exists handle_new_user()     cascade;

-- ── Stores (tenants) ─────────────────────────────────────────
create table stores (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  plan         text not null default 'free' check (plan in ('free','pro','enterprise')),
  trial_ends   timestamptz default (now() + interval '14 days'),
  active       boolean not null default true,
  created_at   timestamptz default now()
);

-- ── Profiles ─────────────────────────────────────────────────
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  store_id   uuid references stores(id) on delete cascade,
  username   text not null,
  full_name  text not null,
  role       text not null default 'staff' check (role in ('owner','admin','staff')),
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- ── Categories ───────────────────────────────────────────────
create table categories (
  id         uuid primary key default uuid_generate_v4(),
  store_id   uuid not null references stores(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now(),
  unique (store_id, name)
);

-- ── Products ─────────────────────────────────────────────────
create table products (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references stores(id) on delete cascade,
  sku             text,
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
  updated_at      timestamptz default now(),
  unique (store_id, sku)
);

-- ── Sales ────────────────────────────────────────────────────
create table sales (
  id             uuid primary key default uuid_generate_v4(),
  store_id       uuid not null references stores(id) on delete cascade,
  receipt_no     text not null,
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
  created_at     timestamptz default now(),
  unique (store_id, receipt_no)
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
  store_id     uuid not null references stores(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  product_name text not null,
  type         text not null check (type in ('INITIAL','ADD','REMOVE','SALE','VOID')),
  qty          integer not null,
  prev_stock   integer,
  reason       text,
  created_by   text,
  created_at   timestamptz default now()
);

-- ── Settings (per store) ─────────────────────────────────────
create table settings (
  store_id uuid not null references stores(id) on delete cascade,
  key      text not null,
  value    text,
  primary key (store_id, key)
);

-- ── Per-store receipt number ─────────────────────────────────
create or replace function next_receipt_no(p_store uuid)
returns text language plpgsql as $$
declare
  prefix  text;
  counter int;
begin
  select value into prefix  from settings where store_id = p_store and key = 'receipt_prefix';
  select value::int into counter from settings where store_id = p_store and key = 'receipt_counter';
  prefix  := coalesce(prefix, 'RCP');
  counter := coalesce(counter, 1);
  insert into settings (store_id, key, value) values (p_store, 'receipt_counter', (counter + 1)::text)
    on conflict (store_id, key) do update set value = (counter + 1)::text;
  return prefix || '-' || lpad(counter::text, 6, '0');
end;
$$;

-- ── Updated_at trigger ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

-- ── Row Level Security ───────────────────────────────────────
alter table stores        enable row level security;
alter table profiles      enable row level security;
alter table categories    enable row level security;
alter table products      enable row level security;
alter table sales         enable row level security;
alter table sale_items    enable row level security;
alter table inventory_log enable row level security;
alter table settings      enable row level security;

create policy "svc stores"     on stores        for all using (true);
create policy "svc profiles"   on profiles      for all using (true);
create policy "svc categories" on categories    for all using (true);
create policy "svc products"   on products      for all using (true);
create policy "svc sales"      on sales         for all using (true);
create policy "svc sale_items" on sale_items    for all using (true);
create policy "svc inv_log"    on inventory_log for all using (true);
create policy "svc settings"   on settings      for all using (true);

select 'Quantomize SaaS schema created successfully!' as status;

-- ── Superadmin column (developer access) ─────────────────────
alter table profiles add column if not exists superadmin boolean not null default false;
