-- Phase 2: Kames Bookstore MVP schema
-- Entities: categories, books, orders, order_items, newsletter_subscribers

-- ============ helpers ============

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ categories ============

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index categories_slug_key on public.categories (slug);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function set_updated_at();

-- ============ books ============

-- Prices are stored as integer whole Algerian dinars (DZD has no circulating
-- subunit), e.g. 2500 = 2,500 DA. This avoids float rounding entirely.
create table public.books (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 300),
  author       text not null check (char_length(btrim(author)) between 1 and 200),
  description  text not null,
  price        integer not null check (price > 0),
  category_id  uuid not null references public.categories (id)
                 on update cascade on delete restrict,
  pages        integer check (pages is null or pages > 0),
  format       text not null default 'paperback'
                 check (format in ('paperback', 'hardcover')),
  stock        integer not null default 0 check (stock >= 0),
  cover_url    text,
  featured     boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index books_category_id_idx on public.books (category_id);
create index books_active_featured_idx on public.books (active, featured)
  where active;
create index books_title_lower_idx on public.books (lower(title));

create trigger trg_books_updated_at
  before update on public.books
  for each row execute function set_updated_at();

-- ============ orders ============

-- Customer identity, delivery details and money amounts are snapshotted on
-- the order itself so historical orders never change if books are edited.
create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text not null check (order_number ~ '^KM-[0-9]{8}-[0-9A-Z]{6}$'),
  customer_name  text not null check (char_length(btrim(customer_name)) between 1 and 160),
  customer_phone text not null check (customer_phone ~ '^[0-9+][0-9 ()-]{6,19}$'),
  wilaya         text not null check (char_length(btrim(wilaya)) between 1 and 80),
  address        text not null check (char_length(btrim(address)) between 1 and 400),
  notes          text,
  subtotal       integer not null check (subtotal > 0),
  delivery_fee   integer not null default 0 check (delivery_fee >= 0),
  total          integer not null check (total > 0),
  payment_method text not null default 'cod'
                   check (payment_method in ('cod')),
  status         text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint orders_total_matches check (total = subtotal + delivery_fee)
);

create unique index orders_order_number_key on public.orders (order_number);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function set_updated_at();

-- ============ order_items ============

-- title and unit_price are snapshots taken at purchase time; editing a book
-- afterwards cannot alter an existing order item.
create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id)
                 on update cascade on delete cascade,
  book_id      uuid not null references public.books (id)
                 on update cascade on delete restrict,
  title        text not null check (char_length(btrim(title)) between 1 and 300),
  unit_price   integer not null check (unit_price > 0),
  quantity     integer not null check (quantity between 1 and 99),
  line_total   integer generated always as (unit_price * quantity) stored,
  created_at   timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_book_id_idx on public.order_items (book_id);

-- The order's subtotal must equal the sum of its item line totals.
create function check_order_subtotal()
returns trigger
language plpgsql
as $$
declare
  items_total integer;
  v_order_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_order_id := old.order_id;
  elsif TG_TABLE_NAME = 'orders' then
    v_order_id := new.id;
  else
    v_order_id := new.order_id;
  end if;
  select coalesce(sum(line_total), 0) into items_total
    from public.order_items where order_items.order_id = v_order_id;
  if items_total <> (select subtotal from public.orders where id = v_order_id) then
    raise exception 'order subtotal % does not match sum of items %',
      (select subtotal from public.orders where id = v_order_id), items_total;
  end if;
  return new;
end;
$$;

create constraint trigger trg_order_items_subtotal
  after insert or update of unit_price, quantity or delete on public.order_items
  for each row when (pg_trigger_depth() = 0)
  execute function check_order_subtotal();

-- Guard against editing subtotal directly on an existing order (insert is
-- exempt because items are added after the order row).
create constraint trigger trg_orders_subtotal_on_update
  after update of subtotal on public.orders
  for each row when (pg_trigger_depth() = 0)
  execute function check_order_subtotal();

-- ============ newsletter_subscribers ============

create table public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                 and char_length(email) <= 320),
  status     text not null default 'active'
               check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));

create trigger trg_newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row execute function set_updated_at();
