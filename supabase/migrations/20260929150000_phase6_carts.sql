-- Phase 6: anonymous database-backed shopping carts.
-- A browser holds a secret cart token (= carts.id, a uuid) in localStorage
-- and passes it as the x-cart-token header on every cart request. RLS
-- policies below only grant access to the cart matching that header.

create table public.carts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,
  quantity   integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_quantity_range check (quantity between 1 and 99),
  constraint cart_items_cart_book_unique unique (cart_id, book_id)
);

create trigger trg_carts_set_updated_at
  before update on public.carts
  for each row execute function set_updated_at();

create trigger trg_cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function set_updated_at();

create index cart_items_cart_id_idx on public.cart_items (cart_id);

-- ---------- Row level security ----------
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

-- Helper: the uuid passed by the client in the x-cart-token header.
create function cart_request_token()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.headers', true)::json ->> 'x-cart-token', ''
  );
$$;

-- A client may create exactly one cart per request carrying its own token
-- (used on first add-to-bag); reading a cart requires the matching token.
create policy carts_token_insert
  on public.carts
  for insert
  to anon
  with check (id::text = cart_request_token());

create policy carts_token_select
  on public.carts
  for select
  to anon
  using (id::text = cart_request_token());

create policy carts_token_delete
  on public.carts
  for delete
  to anon
  using (id::text = cart_request_token());

-- Items are writable only inside the token-matching cart, and the cart
-- must exist and be visible under the carts select policy above.
create policy cart_items_token_select
  on public.cart_items
  for select
  to anon
  using (cart_id::text = cart_request_token());

create policy cart_items_token_insert
  on public.cart_items
  for insert
  to anon
  with check (
    cart_id::text = cart_request_token()
    and exists (
      select 1 from public.carts
      where carts.id = cart_items.cart_id
    )
  );

create policy cart_items_token_update
  on public.cart_items
  for update
  to anon
  using (cart_id::text = cart_request_token())
  with check (cart_id::text = cart_request_token());

create policy cart_items_token_delete
  on public.cart_items
  for delete
  to anon
  using (cart_id::text = cart_request_token());
