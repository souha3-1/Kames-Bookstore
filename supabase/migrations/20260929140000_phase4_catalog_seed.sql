-- Phase 4: catalog seed + cover storage bucket
-- Mirrors the hard-coded storefront catalog (artifacts/kames-shelves/src/App.tsx).

-- ---------- storage bucket ----------
insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do update set public = true;

-- Public read of cover objects; writes stay locked (service role / dashboard only).
create policy book_covers_public_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'book-covers');

-- ---------- categories ----------
insert into public.categories (name, slug, active) values
  ('Fiction',      'fiction',      true),
  ('Romance',      'romance',      true),
  ('Self-growth',  'self-growth',  true),
  ('Classics',     'classics',     true),
  ('Young adult',  'young-adult',  true);

-- ---------- books ----------
-- cover_url points to objects the owner uploads into the book-covers bucket;
-- books without a photo cover render the prototype cover in the UI.
with c as (select id, slug from public.categories)
insert into public.books
  (title, author, description, price, category_id, pages, format, stock, cover_url, featured, active)
values
  ('The Summer of Broken Rules', 'K.L. Walther',
   'Meredith Fox spends the summer at Martha’s Vineyard with a family she has known forever, a wedding to attend, and a game that brings an unexpected romance back into focus.',
   2200, (select id from c where slug = 'romance'), 320, 'paperback', 12,
   'https://wrvpzgngluphrwfhbqmx.supabase.co/storage/v1/object/public/book-covers/summer-of-broken-rules.png', true, true),
  ('The Cheat Sheet', 'Sarah Adams',
   'Bree and Nathan have been best friends for years, but one little cheat sheet threatens to reveal the feelings they have both been trying to hide.',
   2000, (select id from c where slug = 'romance'), 336, 'paperback', 12,
   'https://wrvpzgngluphrwfhbqmx.supabase.co/storage/v1/object/public/book-covers/the-cheat-sheet.png', true, true),
  ('Murder at the Bookstore', 'Sue Minix',
   'She can write the perfect murder mystery. But can she solve one in real life? A cozy bookstore mystery full of books, clues, and a cat with excellent timing.',
   2400, (select id from c where slug = 'fiction'), 288, 'paperback', 12,
   'https://wrvpzgngluphrwfhbqmx.supabase.co/storage/v1/object/public/book-covers/murder-at-the-bookstore.png', true, true),
  ('Problematic Summer Romance', 'Ali Hazelwood',
   'A summer getaway, a family wedding, and a romance that is complicated in all the most entertaining ways. A bright, witty beach read from Ali Hazelwood.',
   2800, (select id from c where slug = 'romance'), 352, 'paperback', 12,
   'https://wrvpzgngluphrwfhbqmx.supabase.co/storage/v1/object/public/book-covers/problematic-summer-romance.png', true, true),
  ('The Comfort Book', 'Matt Haig',
   'Notes, lists and small reminders for difficult days. A book to keep by the bed, dip into slowly, and lend to the friend who needs a little gentleness.',
   2500, (select id from c where slug = 'self-growth'), 272, 'hardcover', 8, null, false, true),
  ('Normal People', 'Sally Rooney',
   'Connell and Marianne grow up in the same small town, orbiting each other through school, university, and the silences between. Intimate, sharp, and impossible to forget.',
   2400, (select id from c where slug = 'romance'), 288, 'paperback', 10, null, false, true),
  ('A Little Life', 'Hanya Yanagihara',
   'Four friends build a life in New York, carrying old wounds and new hopes. An expansive, deeply felt novel about friendship and the people who become family.',
   3900, (select id from c where slug = 'fiction'), 736, 'paperback', 6, null, false, true),
  ('The Alchemist', 'Paulo Coelho',
   'A shepherd follows a recurring dream toward the Egyptian pyramids — and learns to listen closely to the language of the world along the way.',
   1900, (select id from c where slug = 'classics'), 208, 'paperback', 15, null, false, true);
