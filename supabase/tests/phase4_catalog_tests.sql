-- Phase 4 tests: catalog seed + storage bucket.
\set ON_ERROR_STOP on

-- ---------- counts match the hard-coded storefront catalog ----------
do $$
declare n integer;
begin
  select count(*) into n from public.categories where active;
  if n <> 5 then raise exception 'FAIL: expected 5 active categories, got %', n; end if;
  select count(*) into n from public.books where active;
  if n <> 8 then raise exception 'FAIL: expected 8 active books, got %', n; end if;
  select count(*) into n from public.books where featured;
  if n <> 4 then raise exception 'FAIL: expected 4 featured books, got %', n; end if;
end $$;

-- ---------- every book has a valid category ----------
do $$
declare n integer;
begin
  select count(*) into n from public.books b
  join public.categories c on c.id = b.category_id;
  if n <> 8 then raise exception 'FAIL: books missing category join (%)', n; end if;
end $$;

-- ---------- category distribution matches storefront ----------
do $$
declare n integer;
begin
  select count(*) into n from public.books b
  join public.categories c on c.id = b.category_id where c.slug = 'romance';
  if n <> 4 then raise exception 'FAIL: expected 4 romance books, got %', n; end if;
  select count(*) into n from public.books b
  join public.categories c on c.id = b.category_id where c.slug = 'fiction';
  if n <> 2 then raise exception 'FAIL: expected 2 fiction books, got %', n; end if;
end $$;

-- ---------- anon visibility unchanged under RLS ----------
set role anon;
do $$
declare n integer;
begin
  select count(*) into n from public.books;
  if n <> 8 then raise exception 'FAIL: anon cannot see seeded books (%/8)', n; end if;
end $$;
reset role;

-- ---------- anon cannot write to book-covers bucket ----------
set role anon;
do $$
begin
  insert into storage.objects (bucket_id, name) values ('book-covers', 'hacked.png');
  raise exception 'FAIL: anon storage insert accepted';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- bucket exists and is public ----------
do $$
declare pub boolean;
begin
  select public into pub from storage.buckets where id = 'book-covers';
  if pub is not true then raise exception 'FAIL: book-covers bucket not public'; end if;
end $$;

-- ---------- seed is idempotent-guarded: unique slugs/emails not violated by rerun of reset ----------
-- (db reset reruns all migrations from scratch; uniqueness verified in phase 2 suite)

do $$ begin raise notice 'ALL PHASE 4 TESTS PASSED'; end $$;
