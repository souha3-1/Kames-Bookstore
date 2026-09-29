-- Phase 8: real checkout — anonymous token-scoped orders via a
-- security-definer RPC. Clients never insert into orders/order_items
-- directly and cannot tamper with prices: the RPC computes money from
-- the live books table and snapshots it onto the order.

-- ============ wilaya reference ============

create table public.wilayas (
  code integer primary key check (code between 1 and 58),
  name text not null unique check (char_length(btrim(name)) between 1 and 80)
);

insert into public.wilayas (code, name) values
  (1, 'Adrar'), (2, 'Chlef'), (3, 'Laghouat'), (4, 'Oum El Bouaghi'),
  (5, 'Batna'), (6, 'Béjaïa'), (7, 'Biskra'), (8, 'Béchar'),
  (9, 'Blida'), (10, 'Bouira'), (11, 'Tamanrasset'), (12, 'Tébessa'),
  (13, 'Tlemcen'), (14, 'Tiaret'), (15, 'Tizi Ouzou'), (16, 'Alger'),
  (17, 'Djelfa'), (18, 'Jijel'), (19, 'Sétif'), (20, 'Saïda'),
  (21, 'Skikda'), (22, 'Sidi Bel Abbès'), (23, 'Annaba'), (24, 'Guelma'),
  (25, 'Constantine'), (26, 'Médéa'), (27, 'Mostaganem'), (28, 'M''Sila'),
  (29, 'Mascara'), (30, 'Ouargla'), (31, 'Oran'), (32, 'El Bayadh'),
  (33, 'Illizi'), (34, 'Bordj Bou Arreridj'), (35, 'Boumerdès'), (36, 'El Tarf'),
  (37, 'Tindouf'), (38, 'Tissemsilt'), (39, 'El Oued'), (40, 'Khenchela'),
  (41, 'Souk Ahras'), (42, 'Tipaza'), (43, 'Mila'), (44, 'Aïn Defla'),
  (45, 'Naâma'), (46, 'Aïn Témouchent'), (47, 'Ghardaïa'), (48, 'Relizane'),
  (49, 'Timimoun'), (50, 'Bordj Badji Mokhtar'), (51, 'Ouled Djellal'),
  (52, 'Béni Abbès'), (53, 'In Salah'), (54, 'In Guezzam'), (55, 'Touggourt'),
  (56, 'Djanet'), (57, 'El M''Ghair'), (58, 'El Meniaa');

alter table public.wilayas enable row level security;

create policy wilayas_public_read on public.wilayas
  for select to anon, authenticated using (true);

-- ============ extend orders for anonymous checkout ============

alter table public.orders
  add column visitor_id uuid not null default gen_random_uuid(),
  add column wilaya_code integer references public.wilayas (code),
  add column commune text check (char_length(btrim(commune)) between 1 and 120),
  add column delivery_method text not null default 'home'
    check (delivery_method in ('home', 'stopdesk'));

alter table public.orders
  alter column address drop not null;

create index orders_visitor_id_idx on public.orders (visitor_id);

-- ============ place_order RPC ============

-- Flat shipping: home 600 DA, stop desk 400 DA (matches the storefront).
create function public.delivery_fee_for(p_method text)
returns integer
language sql
stable
as $$
  select case p_method when 'home' then 600 when 'stopdesk' then 400 end;
$$;

create function public.place_order(
  p_token uuid,
  p_name text,
  p_phone text,
  p_wilaya_code integer,
  p_commune text,
  p_delivery_method text,
  p_address text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_subtotal integer;
  v_fee integer;
  v_wilaya text;
  v_order_number text;
  v_has_items boolean;
begin
  -- the caller must own the cart they are ordering
  v_has_items := exists (
    select 1 from public.cart_items
    where cart_id = p_token
  );
  if not v_has_items then
    raise exception 'cart is empty';
  end if;

  select name into v_wilaya from public.wilayas where code = p_wilaya_code;
  if v_wilaya is null then
    raise exception 'unknown wilaya code %', p_wilaya_code;
  end if;

  if p_delivery_method = 'home' and coalesce(btrim(p_address), '') = '' then
    raise exception 'delivery address is required for home delivery';
  end if;
  if p_delivery_method = 'stopdesk' and char_length(btrim(coalesce(p_address, ''))) > 400 then
    raise exception 'delivery address is too long';
  end if;

  -- subtotal from live prices, so the client cannot dictate money amounts
  select coalesce(sum(b.price * ci.quantity), 0)
    into v_subtotal
    from public.cart_items ci
    join public.books b on b.id = ci.book_id and b.active
    where ci.cart_id = p_token;

  v_fee := public.delivery_fee_for(p_delivery_method);
  if v_fee is null then
    raise exception 'unknown delivery method %', p_delivery_method;
  end if;

  loop
    begin
      insert into public.orders (
        order_number, visitor_id, customer_name, customer_phone,
        wilaya, wilaya_code, commune, address, notes,
        subtotal, delivery_fee, total, delivery_method
      ) values (
        'KM-' || to_char(now(), 'YYYYMMDD') || '-'
          || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
        p_token, btrim(p_name), btrim(p_phone),
        v_wilaya, p_wilaya_code, btrim(p_commune),
        nullif(btrim(coalesce(p_address, '')), ''),
        nullif(btrim(coalesce(p_notes, '')), ''),
        v_subtotal, v_fee, v_subtotal + v_fee, p_delivery_method
      ) returning id into v_order_id;
      exit;
    exception when unique_violation then
      continue; -- order_number collision: retry with a new suffix
    end;
  end loop;

  insert into public.order_items (order_id, book_id, title, unit_price, quantity)
  select v_order_id, b.id, b.title, b.price, ci.quantity
    from public.cart_items ci
    join public.books b on b.id = ci.book_id and b.active
    where ci.cart_id = p_token;

  -- the bag is empty after a successful order
  delete from public.cart_items where cart_id = p_token;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid, text, text, integer, text, text, text, text) from public;
grant execute on function public.place_order(uuid, text, text, integer, text, text, text, text) to anon;

-- ============ RLS: anon can read only their own orders ============

create policy orders_token_select on public.orders
  for select to anon
  using (visitor_id::text = public.cart_request_token());

create policy order_items_token_select on public.order_items
  for select to anon
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.visitor_id::text = public.cart_request_token()
    )
  );
