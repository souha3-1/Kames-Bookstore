-- Phase 2 schema tests: run after migrations against local stack.
-- Any failure raises; final SELECT prints PASS summary.
-- Run against a fresh `supabase db reset` (the cleanup below also drops the
-- phase 4 catalog seed, which would otherwise collide with these fixtures).

\set ON_ERROR_STOP on

-- ---------- cleanup ----------
delete from public.wishlist_items;
delete from public.cart_items;
delete from public.carts;
delete from public.order_items;
delete from public.orders;
delete from public.books;
delete from public.categories;
delete from public.newsletter_subscribers;

-- ---------- happy path ----------
insert into public.categories (name, slug) values ('Fiction', 'fiction') returning id as cat1_id \gset
insert into public.categories (name, slug) values ('Romance', 'romance') returning id as cat2_id \gset

insert into public.books (title, author, description, price, category_id, pages, stock, featured)
values ('Murder at the Bookstore', 'K. Amine', 'A cozy mystery.', 2400, :'cat1_id', 320, 12, true)
returning id as book_id \gset

insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
values ('KM-20260929-ABC123', 'Souha N.', '0555123456', 'Alger', 'Rue 12, Hydra', 4800, 400, 5200)
returning id as order_id \gset

insert into public.order_items (order_id, book_id, title, unit_price, quantity)
values (:'order_id', :'book_id', 'Murder at the Bookstore', 2400, 2);

-- duplicate slug rejected
do $$
begin
  insert into public.categories (name, slug) values ('Other Fiction', 'fiction');
  raise exception 'FAIL: duplicate slug accepted';
exception when unique_violation then null; end $$;

-- negative price rejected
do $$
begin
  insert into public.books (title, author, description, price, category_id)
  values ('Bad', 'A', 'd', -5, (select id from public.categories where slug='fiction'));
  raise exception 'FAIL: negative price accepted';
exception when check_violation then null; end $$;

-- zero price rejected
do $$
begin
  insert into public.books (title, author, description, price, category_id)
  values ('Bad', 'A', 'd', 0, (select id from public.categories where slug='fiction'));
  raise exception 'FAIL: zero price accepted';
exception when check_violation then null; end $$;

-- invalid format rejected
do $$
begin
  insert into public.books (title, author, description, price, category_id, format)
  values ('Bad', 'A', 'd', 100, (select id from public.categories where slug='fiction'), 'audiobook');
  raise exception 'FAIL: invalid format accepted';
exception when check_violation then null; end $$;

-- negative stock rejected
do $$
begin
  insert into public.books (title, author, description, price, category_id, stock)
  values ('Bad', 'A', 'd', 100, (select id from public.categories where slug='fiction'), -1);
  raise exception 'FAIL: negative stock accepted';
exception when check_violation then null; end $$;

-- NULL required fields rejected
do $$
begin
  insert into public.books (title, author, description, price, category_id)
  values (null, 'A', 'd', 100, (select id from public.categories where slug='fiction'));
  raise exception 'FAIL: null title accepted';
exception when not_null_violation then null; end $$;

-- invalid FK rejected
do $$
begin
  insert into public.books (title, author, description, price, category_id)
  values ('Orphan', 'A', 'd', 100, gen_random_uuid());
  raise exception 'FAIL: bad category FK accepted';
exception when foreign_key_violation then null; end $$;

-- delete category with books must fail (RESTRICT)
do $$
begin
  delete from public.categories where slug = 'fiction';
  raise exception 'FAIL: category delete not restricted';
exception when foreign_key_violation then null; end $$;

-- bad order_number rejected
do $$
begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, total)
  values ('nope', 'X', '0555123456', 'Alger', 'addr', 100, 100);
  raise exception 'FAIL: bad order_number accepted';
exception when check_violation then null; end $$;

-- total mismatch rejected
do $$
begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, delivery_fee, total)
  values ('KM-20260929-XYZ789', 'X', '0555123456', 'Alger', 'addr', 100, 50, 999);
  raise exception 'FAIL: total mismatch accepted';
exception when check_violation then null; end $$;

-- bad phone rejected
do $$
begin
  insert into public.orders (order_number, customer_name, customer_phone, wilaya, address, subtotal, total)
  values ('KM-20260929-DEF456', 'X', 'abc', 'Alger', 'addr', 100, 100);
  raise exception 'FAIL: bad phone accepted';
exception when check_violation then null; end $$;

-- invalid status rejected
do $$
begin
  update public.orders set status = 'teleported' where order_number = 'KM-20260929-ABC123';
  raise exception 'FAIL: invalid status accepted';
exception when check_violation then null; end $$;

-- subtotal must equal item sum (violation on deferred trigger)
do $$
begin
  update public.orders set subtotal = 9999, total = 9999 + delivery_fee where order_number = 'KM-20260929-ABC123';
  raise exception 'FAIL: subtotal/item mismatch accepted';
exception when others then
  if sqlerrm not like 'order subtotal%' then raise exception 'unexpected: %', sqlerrm; end if;
end $$;

-- item FK to order cascade / book restrict
do $$
begin
  delete from public.books where title = 'Murder at the Bookstore';
  raise exception 'FAIL: book with order items deleted';
exception when foreign_key_violation then null; end $$;

-- duplicate newsletter email (case-insensitive) rejected
insert into public.newsletter_subscribers (email) values ('Reader@Example.com');
do $$
begin
  insert into public.newsletter_subscribers (email) values ('reader@example.com');
  raise exception 'FAIL: duplicate email accepted';
exception when unique_violation then null; end $$;

do $$
begin
  insert into public.newsletter_subscribers (email) values ('not-an-email');
  raise exception 'FAIL: bad email accepted';
exception when check_violation then null; end $$;

-- ---------- snapshot integrity ----------
update public.books set title = 'Changed Title', price = 1 where title = 'Murder at the Bookstore';

do $$
declare snapshot_count integer;
begin
  select count(*) into snapshot_count
    from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.title = 'Murder at the Bookstore' and oi.unit_price = 2400
      and o.order_number = 'KM-20260929-ABC123';
  if snapshot_count <> 1 then
    raise exception 'FAIL: order item snapshot changed after book update';
  end if;
end $$;

-- ---------- updated_at trigger ----------
do $$
begin
  perform pg_sleep(0.01);
  update public.categories set name = 'Fiction Novels' where slug = 'fiction';
  if (select updated_at = created_at from public.categories where slug = 'fiction') then
    raise exception 'FAIL: updated_at trigger not working';
  end if;
end $$;

-- ---------- indexes ----------
do $$
declare idx_count integer;
begin
  select count(*) into idx_count from pg_indexes
    where schemaname='public' and indexname in
    ('categories_slug_key','books_category_id_idx','books_active_featured_idx',
     'orders_order_number_key','orders_status_idx','orders_created_at_idx',
     'order_items_order_id_idx','order_items_book_id_idx',
     'newsletter_subscribers_email_key');
  if idx_count <> 9 then
    raise exception 'FAIL: expected indexes missing (%/9)', idx_count;
  end if;
end $$;

-- line_total generated column check
do $$
declare lt integer;
begin
  select line_total into lt from public.order_items limit 1;
  if lt <> 4800 then
    raise exception 'FAIL: line_total generated incorrectly (%)', lt;
  end if;
end $$;

do $$ begin raise notice 'ALL PHASE 2 TESTS PASSED'; end $$;
