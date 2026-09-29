-- Phase 3: Row Level Security
-- Storefront reads are public; everything else is locked until later phases
-- (orders/checkout in Phase 8, admin writes in Phase 9, accounts Phase 10).

alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- ---------- public catalog reads ----------

create policy categories_public_select
  on public.categories
  for select
  to anon, authenticated
  using (active);

create policy books_public_select
  on public.books
  for select
  to anon, authenticated
  using (active);

-- ---------- newsletter opt-in ----------

create policy newsletter_public_insert
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (status = 'active');
