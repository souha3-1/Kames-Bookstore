-- Phase 12 hardening tests: constraint matrix, order/stock integrity and
-- authorization re-checks. Runs as a single transaction and rolls back, so
-- it can be executed against a freshly reset local database without leaving
-- any rows behind:
--   docker exec -i supabase_db_Kames-Bookstore psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/phase12_hardening_tests.sql
-- Note: psql does not interpolate variables inside DO $$ blocks, so fixture
-- ids travel via transaction-local GUCs read with current_setting().

begin;

-- ============ every public table must have RLS enabled ============
do $$ declare v_missing integer; begin
  select count(*) into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_missing <> 0 then
    raise exception 'FAIL: % public tables without row level security', v_missing;
  end if;
end $$;

-- ============ fixture: one category and one book of our own ============
insert into public.categories (name, slug) values ('Phase 12 Cat', 'phase12-hardening-cat');
select set_config('p12.cat', (select id::text from public.categories where slug = 'phase12-hardening-cat'), true);
insert into public.books (title, author, description, price, category_id, stock)
  values ('Phase 12 Book', 'Hardening Author', 'desc', 1200, current_setting('p12.cat')::uuid, 8);
select set_config('p12.book', (select id::text from public.books where title = 'Phase 12 Book'), true);

-- ============ categories: invalid input is rejected ============
do $$ begin
  insert into public.categories (name, slug) values ('   ', 'blank-name');
  raise exception 'FAIL: blank category name accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.categories (name, slug) values (repeat('x', 121), 'too-long-name');
  raise exception 'FAIL: 121-char category name accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.categories (name, slug) values ('Bad Slug', 'Bad Slug!');
  raise exception 'FAIL: invalid category slug accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.categories (name, slug) values ('Duplicate', 'phase12-hardening-cat');
  raise exception 'FAIL: duplicate category slug accepted';
exception when unique_violation then null; end $$;

-- ============ books: invalid input is rejected ============
do $$ begin
  insert into public.books (title, author, description, price, category_id)
    values ('Zero Price', 'A', 'd', 0, current_setting('p12.cat')::uuid);
  raise exception 'FAIL: zero price accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.books (title, author, description, price, category_id)
    values ('Negative Price', 'A', 'd', -100, current_setting('p12.cat')::uuid);
  raise exception 'FAIL: negative price accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.books (title, author, description, price, category_id, stock)
    values ('Negative Stock', 'A', 'd', 900, current_setting('p12.cat')::uuid, -1);
  raise exception 'FAIL: negative stock accepted on insert';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.books (title, author, description, price, category_id)
    values ('   ', 'A', 'd', 900, current_setting('p12.cat')::uuid);
  raise exception 'FAIL: blank book title accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.books (title, author, description, price, category_id, pages)
    values ('Zero Pages', 'A', 'd', 900, current_setting('p12.cat')::uuid, 0);
  raise exception 'FAIL: zero pages accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.books (title, author, description, price, category_id, format)
    values ('Bad Format', 'A', 'd', 900, current_setting('p12.cat')::uuid, 'spiral');
  raise exception 'FAIL: unknown book format accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.books (title, author, description, price, category_id)
    values ('Ghost Category', 'A', 'd', 900, '99999999-9999-9999-9999-999999999999');
  raise exception 'FAIL: unknown category accepted on book insert';
exception when foreign_key_violation then null; end $$;

-- stock cannot be driven negative by an update either (this is the path the
-- admin back-office uses to change stock)
do $$ begin
  update public.books set stock = -1 where id = current_setting('p12.book')::uuid;
  raise exception 'FAIL: negative stock accepted on update';
exception when check_violation then null; end $$;
do $$ begin
  if (select stock from public.books where id = current_setting('p12.book')::uuid) <> 8 then
    raise exception 'FAIL: rejected stock update still changed the row';
  end if;
end $$;

-- ============ cart items: quantity and uniqueness ============
insert into public.carts (id) values ('12121212-1212-1212-1212-121212121212');
insert into public.cart_items (cart_id, book_id, quantity)
  values ('12121212-1212-1212-1212-121212121212', current_setting('p12.book')::uuid, 1);

do $$ begin
  update public.cart_items set quantity = 0
    where cart_id = '12121212-1212-1212-1212-121212121212';
  raise exception 'FAIL: quantity 0 accepted';
exception when check_violation then null; end $$;

do $$ begin
  update public.cart_items set quantity = 100
    where cart_id = '12121212-1212-1212-1212-121212121212';
  raise exception 'FAIL: quantity 100 accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.cart_items (cart_id, book_id, quantity)
    values ('12121212-1212-1212-1212-121212121212', current_setting('p12.book')::uuid, 2);
  raise exception 'FAIL: duplicate cart line accepted';
exception when unique_violation then null; end $$;

do $$ begin
  insert into public.cart_items (cart_id, book_id, quantity)
    values ('12121212-1212-1212-1212-121212121212', '99999999-9999-9999-9999-999999999999', 1);
  raise exception 'FAIL: unknown book accepted in cart';
exception when foreign_key_violation then null; end $$;

do $$ begin
  insert into public.cart_items (cart_id, book_id, quantity)
    values ('99999999-9999-9999-9999-999999999999', current_setting('p12.book')::uuid, 1);
  raise exception 'FAIL: unknown cart accepted';
exception when foreign_key_violation then null; end $$;

-- ============ wishlist: one row per visitor per book ============
insert into public.wishlist_items (visitor_id, book_id)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_setting('p12.book')::uuid);
do $$ begin
  insert into public.wishlist_items (visitor_id, book_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_setting('p12.book')::uuid);
  raise exception 'FAIL: duplicate wishlist row accepted';
exception when unique_violation then null; end $$;

-- ============ newsletter: email shape and case-insensitive uniqueness ============
do $$ begin
  insert into public.newsletter_subscribers (email) values ('not-an-email');
  raise exception 'FAIL: invalid newsletter email accepted';
exception when check_violation then null; end $$;

insert into public.newsletter_subscribers (email) values ('Phase12@Example.com');
do $$ begin
  insert into public.newsletter_subscribers (email) values ('phase12@example.com');
  raise exception 'FAIL: duplicate newsletter email accepted';
exception when unique_violation then null; end $$;

-- ============ orders: money and shape constraints (direct SQL) ============
do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
    values ('KM-BAD-FORMAT', 'T', '0555123456', 'Alger', 'x', 100, 0, 100);
  raise exception 'FAIL: malformed order number accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
    values ('KM-20260101-AAAAAA', 'T', '0555123456', 'Alger', 'x', 0, 0, 0);
  raise exception 'FAIL: zero subtotal accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
    values ('KM-20260101-AAAAAB', 'T', '0555123456', 'Alger', 'x', 100, 600, 100);
  raise exception 'FAIL: total that does not match subtotal + fee accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
    values ('KM-20260101-AAAAAC', 'T', 'not-a-phone', 'Alger', 'x', 100, 0, 100);
  raise exception 'FAIL: malformed phone accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
    values ('KM-20260101-AAAAAD', 'T', '0555123456', '   ', 'x', 100, 0, 100);
  raise exception 'FAIL: blank wilaya name accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, wilaya_code, address, subtotal, delivery_fee, total, status)
    values ('KM-20260101-AAAAAE', 'T', '0555123456', 'Alger', 16, 'x', 100, 0, 100, 'refunded');
  raise exception 'FAIL: unknown order status accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, wilaya_code, address, subtotal, delivery_fee, total)
    values ('KM-20260101-AAAAAF', 'T', '0555123456', 'Alger', 999, 'x', 100, 0, 100);
  raise exception 'FAIL: unknown wilaya code accepted';
exception when foreign_key_violation then null; end $$;

do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total, payment_method)
    values ('KM-20260101-AAAAAG', 'T', '0555123456', 'Alger', 'x', 100, 0, 100, 'card');
  raise exception 'FAIL: non-COD payment method accepted';
exception when check_violation then null; end $$;

do $$ begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total, delivery_method)
    values ('KM-20260101-AAAAAH', 'T', '0555123456', 'Alger', 'x', 100, 0, 100, 'drone');
  raise exception 'FAIL: unknown delivery method accepted';
exception when check_violation then null; end $$;

-- ============ order snapshot immutability ============
insert into public.orders (order_number, customer_name, customer_phone, wilaya, wilaya_code, address, subtotal, delivery_fee, total, delivery_method)
  values ('KM-20260101-SNAP01', 'Snapshot Tester', '0555123456', 'Alger', 16, 'x', 1200, 0, 1200, 'home');
select set_config('p12.order', (select id::text from public.orders where order_number = 'KM-20260101-SNAP01'), true);
insert into public.order_items (order_id, book_id, title, unit_price, quantity)
  values (current_setting('p12.order')::uuid, current_setting('p12.book')::uuid, 'Phase 12 Book', 1200, 1);

-- editing the book afterwards must not rewrite history
update public.books set title = 'Renamed After Order', price = 5000
  where id = current_setting('p12.book')::uuid;
do $$ begin
  if (select title from public.order_items where order_id = current_setting('p12.order')::uuid) <> 'Phase 12 Book' then
    raise exception 'FAIL: book edit rewrote order item title';
  end if;
  if (select unit_price from public.order_items where order_id = current_setting('p12.order')::uuid) <> 1200 then
    raise exception 'FAIL: book edit rewrote order item price';
  end if;
  if (select subtotal from public.orders where id = current_setting('p12.order')::uuid) <> 1200 then
    raise exception 'FAIL: book edit rewrote order subtotal';
  end if;
end $$;

-- subtotal trigger: adding an item that pushes the sum past the subtotal fails
do $$ begin
  insert into public.order_items (order_id, book_id, title, unit_price, quantity)
    values (current_setting('p12.order')::uuid, current_setting('p12.book')::uuid, 'Extra', 100, 1);
  raise exception 'FAIL: order subtotal mismatch accepted';
exception when others then
  if sqlerrm not like 'order subtotal % does not match sum of items %' then
    raise exception 'FAIL: wrong subtotal mismatch error: %', sqlerrm;
  end if;
end $$;

-- ============ a book referenced by an order cannot be deleted ============
do $$ begin
  delete from public.books where id = current_setting('p12.book')::uuid;
  raise exception 'FAIL: book referenced by an order was deleted';
exception when foreign_key_violation then null; end $$;

-- ============ place_order: remaining validation branches ============
update public.cart_items set quantity = 2
  where cart_id = '12121212-1212-1212-1212-121212121212';

do $$ begin
  perform public.place_order(
    '12121212-1212-1212-1212-121212121212', 'Drone Tester', '0555123456',
    16, 'Alger', 'drone', 'Street 1', null);
  raise exception 'FAIL: place_order accepted delivery method drone';
exception when others then
  if sqlerrm <> 'unknown delivery method drone' then
    raise exception 'FAIL: wrong drone error: %', sqlerrm;
  end if;
end $$;

do $$ begin
  perform public.place_order(
    '12121212-1212-1212-1212-121212121212', 'Long Address', '0555123456',
    16, 'Alger', 'stopdesk', repeat('x', 401), null);
  raise exception 'FAIL: place_order accepted a 401-char stopdesk address';
exception when others then
  if sqlerrm <> 'delivery address is too long' then
    raise exception 'FAIL: wrong long-address error: %', sqlerrm;
  end if;
end $$;

-- ============ RLS: anon cannot reach admin-only data or foreign rows ============
set local role anon;
select set_config('request.headers', json_build_object('x-cart-token', '12121212-1212-1212-1212-121212121212')::text, true);

-- admin_users is invisible and unwritable for anon
do $$ begin
  if (select count(*) from public.admin_users) <> 0 then
    raise exception 'FAIL: anon can read admin_users';
  end if;
end $$;
do $$ begin
  insert into public.admin_users (user_id) values ('99999999-9999-9999-9999-999999999999');
  raise exception 'FAIL: anon inserted into admin_users';
exception when insufficient_privilege then null; end $$;

-- anon cannot flip an order's status (verified again as postgres below)
update public.orders set status = 'delivered' where order_number = 'KM-20260101-SNAP01';

-- anon sees no foreign wishlist rows and deleting them is a no-op
do $$ begin
  if (select count(*) from public.wishlist_items) <> 0 then
    raise exception 'FAIL: anon sees foreign wishlist rows';
  end if;
end $$;
delete from public.wishlist_items where visitor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- anon cannot write into a foreign cart
do $$ begin
  insert into public.cart_items (cart_id, book_id, quantity)
    values ('99999999-9999-9999-9999-999999999999', current_setting('p12.book')::uuid, 1);
  raise exception 'FAIL: anon wrote into a foreign cart';
exception when insufficient_privilege then null; end $$;

-- anon cannot edit catalog rows
update public.books set price = 1 where id = current_setting('p12.book')::uuid;
do $$ begin
  if (select price from public.books where id = current_setting('p12.book')::uuid) = 1 then
    raise exception 'FAIL: anon updated a book price';
  end if;
end $$;

reset role;

-- postgres-side verification of the anon attempts above
do $$ begin
  if (select status from public.orders where order_number = 'KM-20260101-SNAP01') <> 'pending' then
    raise exception 'FAIL: anon changed order status';
  end if;
  if (select count(*) from public.wishlist_items where visitor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'FAIL: anon deleted a foreign wishlist row';
  end if;
  if (select price from public.books where id = current_setting('p12.book')::uuid) <> 5000 then
    raise exception 'FAIL: anon changed book price';
  end if;
end $$;

-- ============ RLS: a non-admin authenticated user has no admin powers ============
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, phone, phone_change, phone_change_token)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'phase12-cust@test.local', crypt('secret123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', NULL, NULL, NULL);
select set_config('p12.cust', (select id::text from auth.users where email = 'phase12-cust@test.local'), true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('p12.cust'), 'role', 'authenticated')::text, true);

update public.orders set status = 'confirmed' where order_number = 'KM-20260101-SNAP01';
update public.books set stock = 999 where id = current_setting('p12.book')::uuid;

reset role;

do $$ begin
  if (select status from public.orders where order_number = 'KM-20260101-SNAP01') <> 'pending' then
    raise exception 'FAIL: non-admin authenticated user changed order status';
  end if;
  if (select stock from public.books where id = current_setting('p12.book')::uuid) <> 8 then
    raise exception 'FAIL: non-admin authenticated user changed stock';
  end if;
end $$;

do $$ begin raise notice 'ALL PHASE 12 TESTS PASSED'; end $$;

rollback;
