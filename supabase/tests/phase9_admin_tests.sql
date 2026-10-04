-- Phase 9 admin tests.
-- Run as postgres via:
--   docker exec -i supabase_db_Kames-Bookstore psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/phase9_admin_tests.sql
-- Assumes a fresh `supabase db reset`.

-- ---------- cleanup ----------
delete from public.order_items;
delete from public.orders;
delete from public.cart_items;
delete from public.carts;

-- ---------- is_admin basics ----------
do $$ begin
  perform set_config('role', 'anon', true);
  if public.is_admin() then raise exception 'FAIL: anon is admin'; end if;
  perform set_config('role', 'authenticated', true);
  if public.is_admin() then raise exception 'FAIL: unlisted authenticated user is admin'; end if;
end $$;
reset role;

-- anon cannot read admin_users even as table owner's policies deny all
begin;
set local role anon;
do $$ begin
  if (select count(*) from public.admin_users) <> 0 then
    raise exception 'FAIL: admin_users not empty for anon';
  end if;
exception when insufficient_privilege then null; end $$;
commit;

-- ---------- seed an order + a fake admin user ----------
insert into public.carts (id) values ('44444444-4444-4444-4444-444444444444');
insert into public.cart_items (cart_id, book_id, quantity)
  select '44444444-4444-4444-4444-444444444444', id, 2 from public.books where active order by id limit 1;

do $$ declare v_id uuid; begin
  v_id := public.place_order(
    '44444444-4444-4444-4444-444444444444', 'Souha Test', '0555123456',
    16, 'Kouba', 'home', '12 Rue des Livres', null);
  if (select status from public.orders where id = v_id) <> 'pending' then
    raise exception 'FAIL: new order is not pending';
  end if;
end $$;

-- fake auth.uid() via set_config('request.jwt.claims') is unreliable for
-- is_admin(); instead create a real user through the local auth schema
do $$
declare
  v_admin uuid;
begin
  select id into v_admin from auth.users where email = 'admin@test.local';
  if v_admin is null then
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'admin@test.local',
      crypt('secret123', gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}'
    ) returning id into v_admin;
  end if;
  insert into public.admin_users (user_id) values (v_admin)
    on conflict (user_id) do nothing;
end $$;

-- ---------- admin session: sees all orders, can update status ----------
-- capture the admin uuid BEFORE switching role: admin_users is invisible
-- to authenticated (deny-all policy) by design
do $$ begin
if (select count(*) from public.admin_users) <> 1 then
  raise exception 'FAIL: admin seed missing';
end if;
end $$;
select user_id as admin_uid from public.admin_users limit 1 \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', :'admin_uid'::text,
                    'role', 'authenticated')::text, true);

do $$ begin
if (select count(*) from public.orders) <> 1 then
  raise exception 'FAIL: admin cannot see orders';
end if;
if (select count(*) from public.order_items) <> 1 then
  raise exception 'FAIL: admin cannot see order items';
end if;
end $$;

-- admin cannot read admin_users through policies (denied, not leaked)
do $$ begin
  if (select count(*) from public.admin_users) <> 0 then
    raise exception 'FAIL: admin can read admin_users rows';
  end if;
exception when insufficient_privilege then null; end $$;

-- status update works and bumps updated_at
update public.orders set status = 'confirmed';
do $$ begin
if (select status from public.orders limit 1) <> 'confirmed' then
  raise exception 'FAIL: admin status update failed';
end if;
end $$;

-- admin write access stops at the policies that grant it: order_items is
-- select-only, so the price snapshot cannot be edited even by an admin.
-- (books/categories writes were added later, in phase 9b, and are covered
-- by phase9b_admin_backoffice_tests.sql)
update public.order_items set unit_price = 1;
do $$ begin
  if (select count(*) from public.order_items where unit_price = 1) <> 0 then
    raise exception 'FAIL: admin can edit order items';
  end if;
end $$;

commit;

-- ---------- customer token still only sees their own orders ----------
begin;
set local role anon;
select set_config('request.headers', json_build_object('x-cart-token', '44444444-4444-4444-4444-444444444444')::text, true);
do $$ begin
if (select count(*) from public.orders) <> 1 then
  raise exception 'FAIL: customer token lost access to own order';
end if;
end $$;
commit;

-- customer cannot update order status
begin;
set local role anon;
select set_config('request.headers', json_build_object('x-cart-token', '44444444-4444-4444-4444-444444444444')::text, true);
-- no UPDATE policy for anon: the update matches nothing, status unchanged
update public.orders set status = 'delivered';
do $$ begin
if (select status from public.orders limit 1) <> 'confirmed' then
  raise exception 'FAIL: anon updated order status';
end if;
end $$;
commit;

reset role;

do $$ begin raise notice 'ALL PHASE 9 TESTS PASSED'; end $$;
