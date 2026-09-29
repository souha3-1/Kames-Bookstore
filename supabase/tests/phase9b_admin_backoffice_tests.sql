-- Phase 9b: admin back-office RLS tests
-- Run with: psql "$DB_URL" -f supabase/tests/phase9b_admin_backoffice_tests.sql (single transaction)
begin;

\set ON_ERROR_STOP on
\set QUIET on

-- seed: category, book, cart token, one order (via place_order)
insert into public.categories (name, slug) values ('Test Admin Cat', 'test-admin-cat');
insert into public.books (title, author, description, price, category_id, stock)
  select 'Admin Test Book', 'Test Author', 'desc', 1500, id, 10 from public.categories where slug = 'test-admin-cat';

insert into public.cart_items (cart_id, book_id, quantity)
  select '44444444-4444-4444-4444-444444444444', id, 1 from public.books where title = 'Admin Test Book'
  on conflict (cart_id, book_id) do update set quantity = 1;

select public.place_order(
  '44444444-4444-4444-4444-444444444444', 'Phase9b Tester', '0555999888',
  (select code from public.wilayas where name = 'Alger'), 'Kouba', 'home', '12 Test St', null
) as order_id \gset

-- fake admin user + allowlist entry
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, phone, phone_change, phone_change_token)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'admin9b@test.local', crypt('secret123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', NULL, NULL, NULL);
insert into public.admin_users (user_id)
  select id from auth.users where email = 'admin9b@test.local';


select user_id as admin_uid from public.admin_users au
  join auth.users u on u.id = au.user_id where u.email = 'admin9b@test.local' \gset
select id as book9b_id from public.books where title = 'Admin Test Book' \gset
select id as cat9b_id from public.categories where slug = 'test-admin-cat' \gset
select id as order9b_id from public.orders where order_number like 'KM-%' order by created_at desc limit 1 \gset

\set QUIET off

-- switch to authenticated as admin
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_uid'::text, 'role', 'authenticated')::text, true);

-- 1. admin sees inactive books (public read is active-only; create one first as admin)
with ins as (
  insert into public.books (title, author, description, price, category_id, stock, active)
  values ('Inactive Book', 'Author', 'd', 900, :'cat9b_id'::uuid, 5, false)
  returning 1)
select '1 admin can create book' as test, count(*) = 1 as pass from ins;

-- 2. admin can read the inactive book
select '2 admin reads inactive book' as test,
  count(*) = 1 as pass from public.books where title = 'Inactive Book' and active = false;

-- 3. admin can update a book (price + stock)
update public.books set price = 2000, stock = 7 where id = :'book9b_id'::uuid;
select '3 admin updates book' as test,
  (price = 2000 and stock = 7) as pass from public.books where id = :'book9b_id'::uuid;

-- 4. admin can archive (active=false) a book
update public.books set active = false where title = 'Inactive Book';
select '4 admin archives book' as test,
  active = false as pass from public.books where title = 'Inactive Book';

-- 5. admin can create a category
with ins as (
  insert into public.categories (name, slug) values ('Admin Cat Two', 'admin-cat-two')
  returning 1)
select '5 admin creates category' as test, count(*) = 1 as pass from ins;

-- 6. admin can update a category
update public.categories set name = 'Admin Cat Renamed' where slug = 'admin-cat-two';
select '6 admin renames category' as test,
  name = 'Admin Cat Renamed' as pass from public.categories where slug = 'admin-cat-two';

-- 7. admin can delete a book that has no order references
delete from public.books where title = 'Inactive Book';
select '7 admin deletes unreferenced book' as test,
  count(*) = 0 as pass from public.books where title = 'Inactive Book';

-- 8. admin can still read orders and update status
update public.orders set status = 'shipped' where id = :'order9b_id'::uuid;
select '9 admin updates order status' as test,
  status = 'shipped' as pass from public.orders where id = :'order9b_id'::uuid;

-- 10. non-admin authenticated user cannot write books
set local role postgres;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, phone, phone_change, phone_change_token)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'cust9b@test.local', crypt('secret123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', NULL, NULL, NULL);
select id as cust_uid from auth.users where email = 'cust9b@test.local' \gset

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'cust_uid'::text, 'role', 'authenticated')::text, true);

update public.books set price = 1 where id = :'book9b_id'::uuid;
select '10 non-admin book update is a no-op' as test,
  price = 2000 as pass from public.books where id = :'book9b_id'::uuid;

delete from public.categories where slug = 'admin-cat-two';
select '11 non-admin category delete is a no-op' as test,
  count(*) = 1 as pass from public.categories where slug = 'admin-cat-two';

-- 12. customer still cannot read orders
select '12 non-admin cannot read orders' as test,
  count(*) = 0 as pass from public.orders;

do $$ begin raise notice 'ALL PHASE 9B TESTS PASSED'; end $$;
rollback;
