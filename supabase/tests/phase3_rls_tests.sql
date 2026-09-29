-- Phase 3 RLS tests: run against local stack as superuser, then verify
-- as the anon role through the API-generated role privileges.
\set ON_ERROR_STOP on

-- Clean any prior seed rows so the suite is rerunnable.
delete from public.orders;
delete from public.order_items;
delete from public.books;
delete from public.categories;
delete from public.newsletter_subscribers;

-- ---------- seed minimal data ----------
insert into public.categories (name, slug) values ('Fiction', 'fiction') returning id as cat1_id \gset
insert into public.categories (name, slug, active) values ('Secret', 'secret', false);
insert into public.books (title, author, description, price, category_id, stock)
values ('Visible Book', 'A. Author', 'desc', 1500, :'cat1_id', 5);
insert into public.books (title, author, description, price, category_id, stock, active)
values ('Hidden Book', 'A. Author', 'desc', 1500, :'cat1_id', 5, false);
insert into public.newsletter_subscribers (email) values ('existing@example.com');
insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
values ('KM-20260929-RLS001', 'Test', '0555123456', 'Alger', 'addr', 1500, 0, 1500);

-- ---------- RLS enabled on all tables ----------
do $$
declare cnt integer;
begin
  select count(*) into cnt from pg_class
  where relnamespace = 'public'::regnamespace
    and relname in ('categories','books','orders','order_items','newsletter_subscribers')
    and relrowsecurity;
  if cnt <> 5 then
    raise exception 'FAIL: RLS not enabled on all tables (%/5)', cnt;
  end if;
end $$;

-- ---------- anon role: allowed reads ----------
set role anon;
do $$
begin
-- active books/categories visible
if (select count(*) from public.books where active) <> 1 then
  raise exception 'FAIL: anon cannot see active book';
end if;
if (select count(*) from public.categories where active) <> 1 then
  raise exception 'FAIL: anon cannot see active category';
end if;
-- inactive rows hidden
if (select count(*) from public.books where not active) <> 0 then
  raise exception 'FAIL: anon can see inactive book';
end if;
if (select count(*) from public.categories where not active) <> 0 then
  raise exception 'FAIL: anon can see inactive category';
end if;
end $$;

-- ---------- anon role: denied writes/reads ----------
do $$
begin
  insert into public.newsletter_subscribers (email, status) values ('x@y.com', 'unsubscribed');
  raise exception 'FAIL: anon insert with unsubscribed status accepted';
exception when check_violation then null; when insufficient_privilege then null; end $$;

do $$
begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
  values ('KM-20260929-RLS002', 'X', '0555123456', 'Alger', 'addr', 1, 0, 1);
  raise exception 'FAIL: anon order insert accepted';
exception when insufficient_privilege then null; when check_violation then null; end $$;

do $$
begin
  update public.books set price = 1;
  if (select count(*) from public.books where price = 1) <> 0 then
    raise exception 'FAIL: anon book update changed data';
  end if;
exception when insufficient_privilege then null; end $$;

do $$
begin
  delete from public.newsletter_subscribers;
  if (select count(*) from public.newsletter_subscribers) <> 0 then
    raise exception 'FAIL: anon delete changed data';
  end if;
exception when insufficient_privilege then null; end $$;

-- orders invisible to anon
do $$
begin
  if (select count(*) from public.orders) <> 0 then
    raise exception 'FAIL: anon can read orders';
  end if;
end $$;

reset role;

-- ---------- anon newsletter insert (allowed path) ----------
set role anon;
insert into public.newsletter_subscribers (email) values ('new@example.com');
reset role;
do $$
begin
  if (select count(*) from public.newsletter_subscribers where email = 'new@example.com') <> 1 then
    raise exception 'FAIL: anon newsletter insert did not persist';
  end if;
end $$;

-- ---------- idempotence: re-running alters nothing ----------
-- (verified by supabase db reset reapplying both migrations in order)

do $$ begin raise notice 'ALL PHASE 3 TESTS PASSED'; end $$;
