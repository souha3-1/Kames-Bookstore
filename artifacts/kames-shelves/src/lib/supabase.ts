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
