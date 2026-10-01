import type { AdminBook, CartLine, DeliveryMethod, OrderStatus, Product } from './supabase';

export const HOME_DELIVERY_FEE = 600;
export const STOPDESK_DELIVERY_FEE = 400;

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export const LOW_STOCK_THRESHOLD = 5;

export const formatDzd = (value: number) => `${value.toLocaleString('fr-DZ')} DA`;

const PLACEHOLDER_COVER_TINTS = ['purple', 'gold', 'teal', 'pink'] as const;
const PLACEHOLDER_COVER_BY_TITLE: Record<string, (typeof PLACEHOLDER_COVER_TINTS)[number]> = {
  'a little life': 'purple',
  'normal people': 'gold',
  'the alchemist': 'teal',
  'the comfort book': 'pink',
};

export const placeholderCoverTint = (product: Pick<Product, 'id' | 'title'>) => {
  const byTitle = PLACEHOLDER_COVER_BY_TITLE[product.title.trim().toLowerCase()];
  if (byTitle) return byTitle;
  let hash = 0;
  for (const char of product.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_COVER_TINTS[hash % PLACEHOLDER_COVER_TINTS.length];
};

export const deliveryFeeFor = (method: DeliveryMethod) =>
  method === 'home' ? HOME_DELIVERY_FEE : STOPDESK_DELIVERY_FEE;

export const cartSubtotal = (cart: CartLine[], products: Product[]) =>
  cart.reduce((sum, line) => sum + (products.find((product) => product.id === line.id)?.price ?? 0) * line.quantity, 0);

export const isLowStock = (book: Pick<AdminBook, 'active' | 'stock'>) => book.active && book.stock <= LOW_STOCK_THRESHOLD;
