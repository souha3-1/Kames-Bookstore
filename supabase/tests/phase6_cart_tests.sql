-- Phase 6 cart schema + RLS tests (anonymous carts, no auth).
-- Run as postgres via:
--   docker exec -i supabase_db_Kames-Bookstore psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/phase6_cart_tests.sql
-- Assumes a fresh `supabase db reset` (seed data present, no carts).

-- ---------- cleanup ----------
delete from public.cart_items;
delete from public.carts;

-- ---------- schema basics ----------
do $$
begin
  insert into public.carts (id) values ('11111111-1111-1111-1111-111111111111');

  -- quantity range
  begin
    insert into public.cart_items (cart_id, book_id, quantity)
      select '11111111-1111-1111-1111-111111111111', id, 0 from public.books limit 1;
    raise exception 'FAIL: quantity 0 accepted';
  exception when check_violation then null; end;

  begin
    insert into public.cart_items (cart_id, book_id, quantity)
      select '11111111-1111-1111-1111-111111111111', id, 100 from public.books limit 1;
    raise exception 'FAIL: quantity 100 accepted';
  exception when check_violation then null; end;

  -- valid row for the shared test cart
  insert into public.cart_items (cart_id, book_id, quantity)
    select '11111111-1111-1111-1111-111111111111', id, 1 from public.books order by id limit 1;

  -- unique (cart_id, book_id)
  begin
    insert into public.cart_items (cart_id, book_id, quantity)
      select '11111111-1111-1111-1111-111111111111', id, 1 from public.books order by id limit 1;
    raise exception 'FAIL: duplicate cart/book accepted';
  exception when unique_violation then null; end;

  -- invalid book id rejected
  begin
    insert into public.cart_items (cart_id, book_id, quantity)
      values ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 1);
    raise exception 'FAIL: invalid book_id accepted';
  exception when foreign_key_violation then null; end;

  -- invalid cart id rejected
  begin
    insert into public.cart_items (cart_id, book_id, quantity)
      select '22222222-2222-2222-2222-222222222222', id, 1 from public.books limit 1;
    raise exception 'FAIL: invalid cart_id accepted';
  exception when foreign_key_violation then null; end;

  -- null quantity rejected
  begin
    insert into public.cart_items (cart_id, book_id, quantity)
      select '11111111-1111-1111-1111-111111111111', id, null from public.books limit 1;
    raise exception 'FAIL: null quantity accepted';
  exception when not_null_violation then null; end;
end $$;

-- valid representative insert (different book than the first) works
delete from public.cart_items;
insert into public.cart_items (cart_id, book_id, quantity)
  select '11111111-1111-1111-1111-111111111111', id, 2
    from public.books order by id offset 1 limit 1;
do $$ begin
if (select count(*) from public.cart_items) <> 1 then
  raise exception 'FAIL: valid cart_item insert did not persist';
end if;
end $$;

-- book delete cascades into cart_items
delete from public.books where id = (select book_id from public.cart_items limit 1);
do $$ begin
if (select count(*) from public.cart_items) <> 0 then
  raise exception 'FAIL: book delete did not cascade to cart_items';
end if;
end $$;

-- cart delete cascades into cart_items
insert into public.cart_items (cart_id, book_id, quantity)
  select '11111111-1111-1111-1111-111111111111', id, 1 from public.books order by id limit 1;
delete from public.carts where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
if (select count(*) from public.cart_items) <> 0 then
  raise exception 'FAIL: cart delete did not cascade to cart_items';
end if;
end $$;

-- updated_at trigger on carts
insert into public.carts (id) values ('33333333-3333-3333-3333-333333333333');
do $$
begin
  perform pg_sleep(0.02);
  update public.carts set created_at = created_at where id = '33333333-3333-3333-3333-333333333333';
  if (select updated_at = created_at from public.carts where id = '33333333-3333-3333-3333-333333333333') then
    raise exception 'FAIL: carts.updated_at not maintained';
  end if;
end $$;

-- ---------- RLS as anon, with a cart token header ----------
delete from public.cart_items;
delete from public.carts;

-- a second cart that belongs to "someone else"
insert into public.carts (id) values ('55555555-5555-5555-5555-555555555555');
insert into public.cart_items (cart_id, book_id, quantity)
  select '55555555-5555-5555-5555-555555555555', id, 3 from public.books limit 1;

begin;
set local role anon;
select set_config('request.headers', json_build_object('x-cart-token', '44444444-4444-4444-4444-444444444444')::text, true);

-- insert own cart (token matches id)
insert into public.carts (id) values ('44444444-4444-4444-4444-444444444444');

-- foreign cart id must be rejected
do $$
begin
  insert into public.carts (id) values ('66666666-6666-6666-6666-666666666666');
  raise exception 'FAIL: anon inserted cart with non-matching token';
exception when insufficient_privilege then null; end $$;

-- only the token-matching cart is visible
do $$ begin
if (select count(*) from public.carts) <> 1 then
  raise exception 'FAIL: anon sees wrong number of carts';
end if;
end $$;
do $$ begin
if (select count(*) from public.carts where id = '55555555-5555-5555-5555-555555555555') <> 0 then
  raise exception 'FAIL: anon can see foreign cart';
end if;
end $$;

-- item operations inside own cart
insert into public.cart_items (cart_id, book_id, quantity)
  select '44444444-4444-4444-4444-444444444444', id, 1 from public.books limit 1;
do $$ begin
if (select count(*) from public.cart_items) <> 1 then
  raise exception 'FAIL: anon cart item insert did not persist';
end if;
end $$;

-- item into the foreign cart (exists, token mismatch) must be rejected
do $$
begin
  insert into public.cart_items (cart_id, book_id, quantity)
    select '55555555-5555-5555-5555-555555555555', id, 1 from public.books limit 1;
  raise exception 'FAIL: anon wrote item into foreign cart';
exception when insufficient_privilege then null; end $$;

-- only own item visible
do $$ begin
if (select count(*) from public.cart_items) <> 1 then
  raise exception 'FAIL: anon sees wrong number of cart_items';
end if;
end $$;
do $$ begin
if (select count(*) from public.cart_items where cart_id = '55555555-5555-5555-5555-555555555555') <> 0 then
  raise exception 'FAIL: anon can read foreign cart items';
end if;
end $$;

-- update own item
update public.cart_items set quantity = 4
 where cart_id = '44444444-4444-4444-4444-444444444444';
do $$ begin
if (select quantity from public.cart_items
    where cart_id = '44444444-4444-4444-4444-444444444444') <> 4 then
  raise exception 'FAIL: anon cart item update failed';
end if;
end $$;

-- delete own cart cascades own items
delete from public.carts where id = '44444444-4444-4444-4444-444444444444';
do $$ begin
if (select count(*) from public.cart_items
    where cart_id = '44444444-4444-4444-4444-444444444444') <> 0 then
  raise exception 'FAIL: own items survived cart delete';
end if;
end $$;
commit;

-- as postgres: foreign cart and its item survived anon's delete
do $$ begin
if (select count(*) from public.cart_items
    where cart_id = '55555555-5555-5555-5555-555555555555') <> 1 then
  raise exception 'FAIL: foreign cart items were removed';
end if;
if (select count(*) from public.carts
    where id = '55555555-5555-5555-5555-555555555555') <> 1 then
  raise exception 'FAIL: foreign cart was removed';
end if;
end $$;

-- ---------- missing token header: anon sees nothing ----------
begin;
set local role anon;
select set_config('request.headers', '{}', true);
do $$ begin
if (select count(*) from public.carts) <> 0 then
  raise exception 'FAIL: anon without token sees carts';
end if;
end $$;
do $$ begin
if (select count(*) from public.cart_items) <> 0 then
  raise exception 'FAIL: anon without token sees cart_items';
end if;
end $$;
commit;

reset role;

-- ---------- storefront join shape: cart items with live book data ----------
delete from public.cart_items;
delete from public.carts;
insert into public.carts (id) values ('44444444-4444-4444-4444-444444444444');
insert into public.cart_items (cart_id, book_id, quantity)
  select '44444444-4444-4444-4444-444444444444', id, 2 from public.books where active limit 1;
do $$ begin
if (select count(*) from public.cart_items ci
    join public.books b on b.id = ci.book_id
    where b.price > 0) <> 1 then
  raise exception 'FAIL: cart item did not join to live book price';
end if;
end $$;

do $$ begin raise notice 'ALL PHASE 6 TESTS PASSED'; end $$;
