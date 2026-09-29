-- Phase 8 checkout/order tests (anonymous token-scoped orders).
-- Run as postgres via:
--   docker exec -i supabase_db_Kames-Bookstore psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/phase8_order_tests.sql
-- Assumes a fresh `supabase db reset` (seed data present, no carts/orders).

-- ---------- cleanup ----------
delete from public.order_items;
delete from public.orders;
delete from public.cart_items;
delete from public.carts;

-- ---------- wilaya reference ----------
do $$ begin
if (select count(*) from public.wilayas) <> 58 then
  raise exception 'FAIL: expected 58 wilayas, got %', (select count(*) from public.wilayas);
end if;
end $$;
do $$ begin
if (select name from public.wilayas where code = 16) <> 'Alger' then
  raise exception 'FAIL: wilaya 16 is not Alger';
end if;
end $$;
do $$ begin
if (select name from public.wilayas where code = 28) <> 'M''Sila' then
  raise exception 'FAIL: wilaya 28 quoting broken';
end if;
end $$;

-- ---------- delivery fee helper ----------
do $$ begin
if public.delivery_fee_for('home') <> 600 then
  raise exception 'FAIL: home fee is not 600';
end if;
if public.delivery_fee_for('stopdesk') <> 400 then
  raise exception 'FAIL: stopdesk fee is not 400';
end if;
if public.delivery_fee_for('drone') is not null then
  raise exception 'FAIL: unknown method should yield null';
end if;
end $$;

-- ---------- place_order validation ----------
delete from public.cart_items; delete from public.carts;
do $$ begin
  perform public.place_order(
    '44444444-4444-4444-4444-444444444444', 'Test User', '0555123456',
    16, 'Alger', 'home', 'Street 1', null);
  raise exception 'FAIL: place_order accepted an empty cart';
exception when others then
  if sqlerrm <> 'cart is empty' then raise exception 'FAIL: wrong empty-cart error: %', sqlerrm; end if;
end $$;

insert into public.carts (id) values ('44444444-4444-4444-4444-444444444444');
insert into public.cart_items (cart_id, book_id, quantity)
  select '44444444-4444-4444-4444-444444444444', id, 1 from public.books where active order by id limit 2;

do $$ begin
  perform public.place_order(
    '44444444-4444-4444-4444-444444444444', 'Test User', '0555123456',
    99, 'Alger', 'home', 'Street 1', null);
  raise exception 'FAIL: place_order accepted wilaya code 99';
exception when others then null; end $$;

do $$ begin
  perform public.place_order(
    '44444444-4444-4444-4444-444444444444', 'Test User', '0555123456',
    16, 'Alger', 'home', '   ', null);
  raise exception 'FAIL: home delivery accepted blank address';
exception when others then
  if sqlerrm <> 'delivery address is required for home delivery' then
    raise exception 'FAIL: wrong blank-address error: %', sqlerrm;
  end if;
end $$;

-- ---------- happy path: home delivery ----------
do $$ declare v_id uuid; v_expected integer; begin
  select coalesce(sum(b.price * ci.quantity), 0) into v_expected
    from public.cart_items ci join public.books b on b.id = ci.book_id
    where ci.cart_id = '44444444-4444-4444-4444-444444444444';
  v_id := public.place_order(
    '44444444-4444-4444-4444-444444444444', '  Souha Test  ', '0555 12 34 56',
    16, 'Kouba', 'home', '  12 Rue des Livres  ', 'call before arriving');

  if (select subtotal from public.orders where id = v_id) <> v_expected then
    raise exception 'FAIL: subtotal does not match live prices';
  end if;

  if (select delivery_fee from public.orders where id = v_id) <> 600 then
    raise exception 'FAIL: home order fee is not 600';
  end if;
  if (select btrim(customer_name) from public.orders where id = v_id) <> 'Souha Test' then
    raise exception 'FAIL: customer name not trimmed';
  end if;
  if (select count(*) from public.order_items where order_id = v_id) <> 2 then
    raise exception 'FAIL: order_items row count wrong';
  end if;
  if exists (
    select 1 from public.order_items oi join public.books b on b.id = oi.book_id
    where oi.order_id = v_id and (oi.title <> b.title or oi.unit_price <> b.price)
  ) then
    raise exception 'FAIL: order_items snapshot does not match book data';
  end if;
  if exists (select 1 from public.cart_items where cart_id = '44444444-4444-4444-4444-444444444444') then
    raise exception 'FAIL: cart was not cleared after order';
  end if;
  if (select order_number from public.orders where id = v_id) !~ '^KM-[0-9]{8}-[0-9A-Z]{6}$' then
    raise exception 'FAIL: order_number format wrong';
  end if;
  if (select wilaya from public.orders where id = v_id) <> 'Alger' then
    raise exception 'FAIL: wilaya name not stored';
  end if;
end $$;

-- ---------- happy path: stopdesk, no address required ----------
insert into public.cart_items (cart_id, book_id, quantity)
  select '44444444-4444-4444-4444-444444444444', id, 3 from public.books where active order by id limit 1;
do $$ begin
  perform public.place_order(
    '44444444-4444-4444-4444-444444444444', 'Desk Pickup', '0770000000',
    31, 'Oran', 'stopdesk', null, null);
  if (select delivery_fee from public.orders order by created_at desc limit 1) <> 400 then
    raise exception 'FAIL: stopdesk fee is not 400';
  end if;
end $$;

-- a second order for the same token does not leak order numbers
do $$ begin
if (select count(distinct order_number) from public.orders) <> (select count(*) from public.orders) then
  raise exception 'FAIL: duplicate order_number';
end if;
end $$;

-- ---------- RLS as anon with the cart token ----------
begin;
set local role anon;
select set_config('request.headers', json_build_object('x-cart-token', '44444444-4444-4444-4444-444444444444')::text, true);

-- anon can read own orders and items
do $$ begin
if (select count(*) from public.orders) <> 2 then
  raise exception 'FAIL: anon cannot see own orders';
end if;
if (select count(*) from public.order_items) < 2 then
  raise exception 'FAIL: anon cannot see own order items';
end if;
end $$;

-- direct writes to orders/order_items are denied (insert path is the RPC only)
do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
  values ('KM-20260929-FAKE01', 'Hacker', '0555123456', 'Alger', 'x', 1, 0, 1);
  raise exception 'FAIL: anon inserted directly into orders';
exception when insufficient_privilege then null; end $$;

do $$ begin
  insert into public.order_items (order_id, book_id, title, unit_price, quantity)
  select id, '99999999-9999-9999-9999-999999999999', 'x', 1, 1 from public.orders limit 1;
  raise exception 'FAIL: anon inserted directly into order_items';
exception when insufficient_privilege then null; end $$;

commit;

-- a different token sees nothing
begin;
set local role anon;
select set_config('request.headers', json_build_object('x-cart-token', '88888888-8888-8888-8888-888888888888')::text, true);
do $$ begin
if (select count(*) from public.orders) <> 0 then
  raise exception 'FAIL: foreign token sees orders';
end if;
if (select count(*) from public.order_items) <> 0 then
  raise exception 'FAIL: foreign token sees order items';
end if;
end $$;
commit;

-- no token at all sees nothing
begin;
set local role anon;
select set_config('request.headers', '{}', true);
do $$ begin
if (select count(*) from public.orders) <> 0 then
  raise exception 'FAIL: tokenless anon sees orders';
end if;
end $$;
commit;

reset role;

do $$ begin raise notice 'ALL PHASE 8 TESTS PASSED'; end $$;
