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

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type OrderItem = { title: string; unit_price: number; quantity: number };

export type AdminOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  wilaya: string;
  commune: string | null;
  delivery_method: 'home' | 'stopdesk';
  address: string | null;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
};

const ADMIN_SESSION_KEY = 'kames-admin-session';

export type AdminSession = { access_token: string; expires_at: number };

export function getAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    return session.expires_at > Math.floor(Date.now() / 1000) + 60 ? session : null;
  } catch {
    return null;
  }
}

export function adminSignOut(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export async function adminSignIn(email: string, password: string): Promise<AdminSession> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Sign in failed (${response.status})`);
  const data = (await response.json()) as { access_token: string; expires_at: number };
  const session: AdminSession = { access_token: data.access_token, expires_at: data.expires_at };
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
}

function adminHeaders(session: AdminSession): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchAllOrders(session: AdminSession): Promise<AdminOrder[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?select=*,order_items(title,unit_price,quantity)&order=created_at.desc`,
    { headers: adminHeaders(session) },
  );
  if (!response.ok) throw new Error(`Orders request failed (${response.status})`);
  return (await response.json()) as AdminOrder[];
}

export async function updateOrderStatus(session: AdminSession, orderId: string, status: OrderStatus): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(session), Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(`Status update failed (${response.status})`);
}

export type AdminBook = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  category_id: string;
  pages: number | null;
  format: 'paperback' | 'hardcover';
  stock: number;
  cover_url: string | null;
  featured: boolean;
  active: boolean;
  categories?: { name: string };
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

export type BookInput = {
  title: string;
  author: string;
  description: string;
  price: number;
  category_id: string;
  pages: number | null;
  format: 'paperback' | 'hardcover';
  stock: number;
  cover_url: string | null;
  featured: boolean;
  active: boolean;
};

export async function fetchAdminBooks(session: AdminSession): Promise<AdminBook[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/books?select=*,categories(name)&order=created_at.desc`,
    { headers: adminHeaders(session) },
  );
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  return (await response.json()) as AdminBook[];
}

export async function fetchAdminCategories(session: AdminSession): Promise<AdminCategory[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&order=name`,
    { headers: adminHeaders(session) },
  );
  if (!response.ok) throw new Error(`Categories request failed (${response.status})`);
  return (await response.json()) as AdminCategory[];
}

export async function createBook(session: AdminSession, input: BookInput): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/books`, {
    method: 'POST',
    headers: { ...adminHeaders(session), Prefer: 'return=minimal' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Book create failed (${response.status})`);
}

export async function updateBook(session: AdminSession, bookId: string, patch: Partial<BookInput>): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${bookId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(session), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`Book update failed (${response.status})`);
}

export async function deleteBook(session: AdminSession, bookId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${bookId}`, {
    method: 'DELETE',
    headers: adminHeaders(session),
  });
  if (!response.ok) throw new Error(`Book delete failed (${response.status})`);
}

export async function createCategory(session: AdminSession, name: string, slug: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/categories`, {
    method: 'POST',
    headers: { ...adminHeaders(session), Prefer: 'return=minimal' },
    body: JSON.stringify({ name, slug }),
  });
  if (!response.ok) throw new Error(`Category create failed (${response.status})`);
}

export async function updateCategory(session: AdminSession, categoryId: string, patch: { name?: string; slug?: string; active?: boolean }): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/categories?id=eq.${categoryId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(session), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`Category update failed (${response.status})`);
}

export async function deleteCategory(session: AdminSession, categoryId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/categories?id=eq.${categoryId}`, {
    method: 'DELETE',
    headers: adminHeaders(session),
  });
  if (!response.ok) throw new Error(`Category delete failed (${response.status})`);
}

export async function uploadCoverImage(session: AdminSession, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${crypto.randomUUID()}.${extension}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/book-covers/${path}`, {
    method: 'POST',
    headers: { ...adminHeaders(session), 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' },
    body: file,
  });
  if (!response.ok) throw new Error(`Cover upload failed (${response.status})`);
  return `${SUPABASE_URL}/storage/v1/object/public/book-covers/${path}`;
}
