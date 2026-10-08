-- Remarcá: modelo de datos (especificación, sección 5) con seguridad por comercio (RLS).
-- Todavía no está conectado a la app: hoy los datos viven en el dispositivo (IndexedDB).
-- Aplicar con `supabase db push` cuando se active la sincronización con la nube.

create extension if not exists pg_trgm;

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  margin numeric not null default 40,
  iva numeric not null default 21,
  round_step numeric not null default 10,
  round_mode text not null default 'up' check (round_mode in ('up', 'near')),
  ending text not null default '' check (ending in ('', '9', '90', '99')),
  big_change_pct numeric not null default 20,
  plan text not null default 'gratis',
  created_at timestamptz not null default now()
);

create table store_members (
  store_id uuid not null references stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'employee')),
  primary key (store_id, user_id)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  name text not null,
  margin numeric,
  iva numeric,
  unique (store_id, name)
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  name text not null,
  iva_included boolean not null default false,
  discount_pct numeric not null default 0,
  ai_hint text not null default '',
  sheet_columns jsonb,
  last_list_at timestamptz
);

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  code text not null default '',
  name text not null,
  category_id uuid references categories (id) on delete set null,
  supplier_id uuid references suppliers (id) on delete set null,
  cost numeric not null default 0, -- por UNIDAD DE VENTA, con IVA y bonificación aplicados
  price numeric not null default 0,
  margin numeric,
  locked boolean not null default false,
  buy_type text not null default 'u' check (buy_type in ('u', 'pack', 'kg')),
  buy_n int not null default 1,
  sell_unit text not null default 'u' check (sell_unit in ('u', 'kg', '100g')),
  price_at timestamptz,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
create index products_store_idx on products (store_id);
create index products_name_trgm on products using gin (name gin_trgm_ops);

create table product_history (
  product_id uuid not null references products (id) on delete cascade,
  at timestamptz not null default now(),
  cost numeric not null,
  price numeric not null,
  batch_id uuid
);
create index product_history_idx on product_history (product_id, at);

create table supplier_links (
  supplier_id uuid not null references suppliers (id) on delete cascade,
  item_key text not null,
  product_id uuid references products (id) on delete cascade,
  ignored boolean not null default false,
  primary key (supplier_id, item_key)
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  supplier_id uuid references suppliers (id) on delete set null,
  source text not null check (source in ('foto', 'pdf', 'excel', 'texto')),
  files text[] not null default '{}',
  status text not null default 'pendiente',
  ai_cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create table list_items (
  list_id uuid not null references lists (id) on delete cascade,
  code text not null default '',
  description text not null,
  listed_price numeric not null,
  units int not null default 1,
  product_id uuid references products (id) on delete set null,
  match_type text,
  score numeric,
  state text,
  include boolean not null default true,
  price_override numeric
);

create table batches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  list_id uuid references lists (id) on delete set null,
  kind text not null check (kind in ('lista', 'recalculo')),
  counts jsonb not null default '{}',
  prev_supplier_last_list_at timestamptz,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

create table batch_changes (
  batch_id uuid not null references batches (id) on delete cascade,
  product_id uuid not null,
  before jsonb, -- NULL = producto creado
  after jsonb not null
);

-- ---------- seguridad: cada usuario ve solo los comercios de los que es miembro ----------

create or replace function is_member(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from store_members where store_id = s and user_id = auth.uid());
$$;

alter table stores enable row level security;
alter table store_members enable row level security;
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table product_history enable row level security;
alter table supplier_links enable row level security;
alter table lists enable row level security;
alter table list_items enable row level security;
alter table batches enable row level security;
alter table batch_changes enable row level security;

create policy stores_rw on stores for all using (is_member(id)) with check (is_member(id));
create policy members_self on store_members for select using (user_id = auth.uid());
create policy categories_rw on categories for all using (is_member(store_id)) with check (is_member(store_id));
create policy suppliers_rw on suppliers for all using (is_member(store_id)) with check (is_member(store_id));
create policy products_rw on products for all using (is_member(store_id)) with check (is_member(store_id));
create policy lists_rw on lists for all using (is_member(store_id)) with check (is_member(store_id));
create policy batches_rw on batches for all using (is_member(store_id)) with check (is_member(store_id));
create policy history_rw on product_history for all
  using (exists (select 1 from products p where p.id = product_id and is_member(p.store_id)))
  with check (exists (select 1 from products p where p.id = product_id and is_member(p.store_id)));
create policy links_rw on supplier_links for all
  using (exists (select 1 from suppliers s where s.id = supplier_id and is_member(s.store_id)))
  with check (exists (select 1 from suppliers s where s.id = supplier_id and is_member(s.store_id)));
create policy list_items_rw on list_items for all
  using (exists (select 1 from lists l where l.id = list_id and is_member(l.store_id)))
  with check (exists (select 1 from lists l where l.id = list_id and is_member(l.store_id)));
create policy batch_changes_rw on batch_changes for all
  using (exists (select 1 from batches b where b.id = batch_id and is_member(b.store_id)))
  with check (exists (select 1 from batches b where b.id = batch_id and is_member(b.store_id)));

-- Al crear un comercio, quien lo crea queda como dueño.
create or replace function create_store(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  insert into stores (name) values (p_name) returning id into sid;
  insert into store_members (store_id, user_id, role) values (sid, auth.uid(), 'owner');
  return sid;
end;
$$;
