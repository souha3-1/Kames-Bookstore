-- Phase 7: database-backed wishlist for anonymous visitors (no auth).
-- Each visitor's wishlist is keyed by a random uuid token kept in their
-- browser and sent as the x-cart-token request header (same token as carts).

create table public.wishlist_items (
  visitor_id uuid not null,
  book_id uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (visitor_id, book_id)
);

create index wishlist_items_visitor_id_idx on public.wishlist_items (visitor_id);

alter table public.wishlist_items enable row level security;

create policy wishlist_token_select on public.wishlist_items
  for select to anon
  using (visitor_id::text = public.cart_request_token());

create policy wishlist_token_insert on public.wishlist_items
  for insert to anon
  with check (visitor_id::text = public.cart_request_token());

create policy wishlist_token_delete on public.wishlist_items
  for delete to anon
  using (visitor_id::text = public.cart_request_token());
