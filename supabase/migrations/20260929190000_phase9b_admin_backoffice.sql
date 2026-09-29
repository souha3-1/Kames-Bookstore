-- Phase 9b: admin back-office write access
-- Admins (admin_users allowlist) can manage the catalog: books and categories.

create policy books_admin_select on public.books
  for select to authenticated using (public.is_admin());

create policy books_admin_insert on public.books
  for insert to authenticated with check (public.is_admin());

create policy books_admin_update on public.books
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy books_admin_delete on public.books
  for delete to authenticated using (public.is_admin());

create policy categories_admin_select on public.categories
  for select to authenticated using (public.is_admin());

create policy categories_admin_insert on public.categories
  for insert to authenticated with check (public.is_admin());

create policy categories_admin_update on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy categories_admin_delete on public.categories
  for delete to authenticated using (public.is_admin());
