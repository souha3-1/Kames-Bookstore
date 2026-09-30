-- Admin enhancements: storage bucket for book cover uploads
-- Covers are uploaded by the admin back-office only; reads are public so
-- the storefront can render them without a session.

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

create policy book_covers_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'book-covers');

create policy book_covers_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'book-covers' and public.is_admin());

create policy book_covers_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'book-covers' and public.is_admin());
