-- Phase 7 wishlist tests (anonymous, token-scoped).
-- Run after a fresh `supabase db reset`:
--   docker exec -i supabase_db_Kames-Bookstore psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/phase7_wishlist_tests.sql

-- ---------- cleanup ----------
delete from public.wishlist_items;

-- ---------- schema basics ----------
do $$
begin
  -- null book_id rejected
  begin
    insert into public.wishlist_items (visitor_id, book_id)
      values ('77777777-7777-7777-7777-777777777777', null);
    raise exception 'FAIL: null book_id accepted';
  exception when not_null_violation then null; end;

  -- invalid book id rejected
  begin
    insert into public.wishlist_items (visitor_id, book_id)
      values ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999');
    raise exception 'FAIL: invalid book_id accepted';
  exception when foreign_key_violation then null; end;

  -- valid insert works
  insert into public.wishlist_items (visitor_id, book_id)
    select '77777777-7777-7777-7777-777777777777', id from public.books order by id limit 1;

  -- duplicate (visitor, book) rejected
  begin
    insert into public.wishlist_items (visitor_id, book_id)
      select '77777777-7777-7777-7777-777777777777', id from public.books order by id limit 1;
    raise exception 'FAIL: duplicate wishlist row accepted';
  exception when unique_violation then null; end;

  -- second book for same visitor works
  insert into public.wishlist_items (visitor_id, book_id)
    select '77777777-7777-7777-7777-777777777777', id from public.books order by id offset 1 limit 1;

  if (select count(*) from public.wishlist_items) <> 2 then
    raise exception 'FAIL: expected 2 wishlist rows';
  end if;
end $$;

-- book delete cascades into wishlist_items
delete from public.books where id = (select book_id from public.wishlist_items order by book_id limit 1);
do $$ begin
if (select count(*) from public.wishlist_items) <> 1 then
  raise exception 'FAIL: book delete did not cascade to wishlist_items';
end if;
end $$;

-- ---------- RLS as anon, with a token header ----------
delete from public.wishlist_items;

-- rows that belong to "someone else"
insert into public.wishlist_items (visitor_id, book_id)
  select '88888888-8888-8888-8888-888888888888', id from public.books order by id limit 1;

begin;
set local role anon;
select set_config('request.headers', json_build_object('x-cart-token', '77777777-7777-7777-7777-777777777777')::text, true);

-- insert own rows
insert into public.wishlist_items (visitor_id, book_id)
  select '77777777-7777-7777-7777-777777777777', id from public.books order by id limit 2;

-- foreign visitor id must be rejected
do $$
begin
  insert into public.wishlist_items (visitor_id, book_id)
    select '88888888-8888-8888-8888-888888888888', id from public.books order by id offset 2 limit 1;
  raise exception 'FAIL: anon inserted wishlist row for foreign visitor';
exception when insufficient_privilege then null; end $$;

-- only own rows visible
do $$ begin
if (select count(*) from public.wishlist_items) <> 2 then
  raise exception 'FAIL: anon sees wrong number of wishlist rows';
end if;
if (select count(*) from public.wishlist_items where visitor_id = '88888888-8888-8888-8888-888888888888') <> 0 then
  raise exception 'FAIL: anon can see foreign wishlist rows';
end if;
end $$;

-- delete own row works
delete from public.wishlist_items where visitor_id = '77777777-7777-7777-7777-777777777777';
do $$ begin
if (select count(*) from public.wishlist_items) <> 0 then
  raise exception 'FAIL: anon could not delete own wishlist rows';
end if;
end $$;
commit;

-- as postgres: foreign rows survived anon activity
do $$ begin
if (select count(*) from public.wishlist_items where visitor_id = '88888888-8888-8888-8888-888888888888') <> 1 then
  raise exception 'FAIL: foreign wishlist rows were removed';
end if;
end $$;

-- ---------- missing token header: anon sees nothing ----------
begin;
set local role anon;
select set_config('request.headers', '{}', true);
do $$ begin
if (select count(*) from public.wishlist_items) <> 0 then
  raise exception 'FAIL: anon without token sees wishlist rows';
end if;
end $$;
commit;

reset role;

-- ---------- cleanup ----------
delete from public.wishlist_items;

do $$ begin raise notice 'ALL PHASE 7 TESTS PASSED'; end $$;
