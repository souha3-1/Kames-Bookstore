-- Phase 9: admin orders dashboard.
-- One (or more) Supabase Auth accounts are allow-listed in admin_users;
-- only those accounts (role authenticated) may read orders/order_items
-- and update order status. Anonymous customers keep exactly the access
-- they had in Phase 8.

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- no policies on admin_users itself: it stays invisible to everyone;
-- membership is checked through this security-definer helper
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ============ admin policies on orders ============

create policy orders_admin_select on public.orders
  for select to authenticated
  using (public.is_admin());

create policy orders_admin_update on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy order_items_admin_select on public.order_items
  for select to authenticated
  using (public.is_admin());
