const SUPABASE_URL = 'https://wrvpzgngluphrwfhbqmx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rzYr8AoyrTm3BRUSiZWFFg_jRmw6K9l';

type BookRow = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  pages: number;
  format: 'paperback' | 'hardcover';
  cover_url: string | null;
  featured: boolean;
  categories: { name: string } | null;
};

export type Product = {
  id: string;
  title: string;
  author: string;
  price: number;
  category: string;
  description: string;
  coverImage?: string;
  featured: boolean;
  pages: number;
  format: string;
};

export async function fetchCatalog(): Promise<Product[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/books?select=id,title,author,description,price,pages,format,cover_url,featured,categories(name)&active=eq.true&order=featured.desc,title.asc`,
    { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } },
  );
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const rows = (await response.json()) as BookRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    price: row.price,
    category: row.categories?.name ?? 'Fiction',
    description: row.description,
    coverImage: row.cover_url ?? undefined,
    featured: row.featured,
    pages: row.pages,
    format: row.format === 'hardcover' ? 'Hardcover' : 'Paperback',
  }));
}

export type CartLine = { id: string; quantity: number };

const CART_TOKEN_KEY = 'kames-cart-token';

export function getCartToken(): string {
  let token = localStorage.getItem(CART_TOKEN_KEY);
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    token = crypto.randomUUID();
    localStorage.setItem(CART_TOKEN_KEY, token);
  }
  return token;
}

const cartHeaders = (token: string): HeadersInit => ({
  apikey: SUPABASE_PUBLISHABLE_KEY,
  'x-cart-token': token,
  'Content-Type': 'application/json',
});

type CartItemRow = { book_id: string; quantity: number };

export async function fetchCart(token: string): Promise<CartLine[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cart_items?select=book_id,quantity&cart_id=eq.${token}&order=book_id`,
    { headers: cartHeaders(token) },
  );
  if (!response.ok) throw new Error(`Cart request failed (${response.status})`);
  const rows = (await response.json()) as CartItemRow[];
  return rows.map((row) => ({ id: row.book_id, quantity: row.quantity }));
}

async function ensureCart(token: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/carts`, {
    method: 'POST',
    headers: { ...cartHeaders(token), Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ id: token }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Cart creation failed (${response.status})`);
  }
}

export async function setCartItem(token: string, bookId: string, quantity: number): Promise<void> {
  await ensureCart(token);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/cart_items?on_conflict=cart_id,book_id`, {
    method: 'POST',
    headers: { ...cartHeaders(token), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ cart_id: token, book_id: bookId, quantity }),
  });
  if (!response.ok) throw new Error(`Cart update failed (${response.status})`);
}

export async function deleteCartItem(token: string, bookId: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/cart_items?cart_id=eq.${token}&book_id=eq.${bookId}`,
    { method: 'DELETE', headers: cartHeaders(token) },
  );
  if (!response.ok) throw new Error(`Cart removal failed (${response.status})`);
}

export async function clearCartItems(token: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/cart_items?cart_id=eq.${token}`, {
    method: 'DELETE',
    headers: cartHeaders(token),
  });
  if (!response.ok) throw new Error(`Cart clear failed (${response.status})`);
}

export async function fetchWishlist(token: string): Promise<string[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/wishlist_items?select=book_id&visitor_id=eq.${token}&order=book_id`,
    { headers: cartHeaders(token) },
  );
  if (!response.ok) throw new Error(`Wishlist request failed (${response.status})`);
  const rows = (await response.json()) as { book_id: string }[];
  return rows.map((row) => row.book_id);
}

export async function addWishlistItem(token: string, bookId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/wishlist_items`, {
    method: 'POST',
    headers: { ...cartHeaders(token), Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ visitor_id: token, book_id: bookId }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Wishlist add failed (${response.status})`);
  }
}

export async function deleteWishlistItem(token: string, bookId: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/wishlist_items?visitor_id=eq.${token}&book_id=eq.${bookId}`,
    { method: 'DELETE', headers: cartHeaders(token) },
  );
  if (!response.ok) throw new Error(`Wishlist removal failed (${response.status})`);
}

export type DeliveryMethod = 'home' | 'stopdesk';

export type PlaceOrderInput = {
  name: string;
  phone: string;
  wilayaCode: number;
  commune: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  notes: string;
};

export const HOME_DELIVERY_FEE = 600;
export const STOPDESK_DELIVERY_FEE = 400;

export async function placeOrder(token: string, input: PlaceOrderInput): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/place_order`, {
    method: 'POST',
    headers: cartHeaders(token),
    body: JSON.stringify({
      p_token: token,
      p_name: input.name,
      p_phone: input.phone,
      p_wilaya_code: input.wilayaCode,
      p_commune: input.commune,
      p_delivery_method: input.deliveryMethod,
      p_address: input.address,
      p_notes: input.notes || null,
    }),
  });
  if (!response.ok) throw new Error(`Order failed (${response.status})`);
  return (await response.json()) as string;
}
