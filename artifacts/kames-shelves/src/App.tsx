import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { fetchCatalog, getCartToken, fetchCart, setCartItem, deleteCartItem, clearCartItems, fetchWishlist, addWishlistItem, deleteWishlistItem, placeOrder, HOME_DELIVERY_FEE, STOPDESK_DELIVERY_FEE, adminSignIn, adminSignOut, getAdminSession, fetchAllOrders, updateOrderStatus, fetchAdminBooks, fetchAdminCategories, createBook, updateBook, deleteBook, createCategory, updateCategory, deleteCategory, uploadCoverImage, type Product, type CartLine, type DeliveryMethod, type AdminOrder, type OrderStatus, type AdminSession, type AdminBook, type AdminCategory, type BookInput } from './lib/supabase';
import { WILAYAS } from './lib/algeria';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

type Category = 'All' | 'Fiction' | 'Romance' | 'Self-growth' | 'Classics' | 'Young adult';

const categories: { name: Category; icon: string }[] = [
  { name: 'All', icon: '✦' },
  { name: 'Fiction', icon: '◌' },
  { name: 'Romance', icon: '♡' },
  { name: 'Self-growth', icon: '✿' },
  { name: 'Classics', icon: '▤' },
  { name: 'Young adult', icon: '☆' },
];

const formatDzd = (value: number) => `${value.toLocaleString('fr-DZ')} DA`;

function Cover({ product, large = false }: { product: Product; large?: boolean }) {
  if (product.coverImage) {
    return (
      <div className={`cover-card cover-photo ${large ? 'large-cover' : ''}`} data-testid={`cover-${product.id}`}>
        <img src={product.coverImage} alt={`${product.title} by ${product.author}`} />
      </div>
    );
  }
  return (
    <div className={`cover-card ${large ? 'large-cover' : ''}`} data-testid={`cover-${product.id}`}>
      <small>prototype cover</small>
      <b>{product.title}</b>
      <i>{product.author}</i>
    </div>
  );
}

function Header({
  location,
  cartCount,
  wishlistCount,
  onNavigate,
}: {
  location: string;
  cartCount: number;
  wishlistCount: number;
  onNavigate: (path: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = (path: string) => {
    setMenuOpen(false);
    onNavigate(path);
  };
  const isActive = (path: string) => location === path || (path === '/shop' && location.startsWith('/shop'));
  return (
    <>
      <div className="announcement">Delivery everywhere in Algeria · Cash on delivery across Algeria</div>
      <header className="topbar">
        <div className="container topbar-inner">
          <button className="brand" onClick={() => nav('/')} data-testid="link-home">
            <span className="brand-mark"><BookOpen size={19} strokeWidth={1.7} /></span>
            <span><span className="brand-name">Kame&apos;s Shelves</span><span className="brand-sub">for your next chapter</span></span>
          </button>
          <nav className="desktop-nav" aria-label="Main navigation">
            <button className={`nav-link ${isActive('/') ? 'active' : ''}`} onClick={() => nav('/')} data-testid="link-nav-home">Home</button>
            <button className={`nav-link ${isActive('/shop') ? 'active' : ''}`} onClick={() => nav('/shop')} data-testid="link-nav-shop">Shop all</button>
            <button className={`nav-link ${isActive('/wishlist') ? 'active' : ''}`} onClick={() => nav('/wishlist')} data-testid="link-nav-wishlist">Saved for later</button>
          </nav>
          <div className="top-actions">
            <button className="icon-btn search-action" onClick={() => nav('/shop')} aria-label="Search books" data-testid="button-search"><Search size={18} strokeWidth={1.8} /></button>
            <button className="icon-btn" onClick={() => nav('/wishlist')} aria-label="Wishlist" data-testid="button-wishlist"><Heart size={18} strokeWidth={1.8} /><span className="count">{wishlistCount}</span></button>
            <button className="icon-btn" onClick={() => nav('/cart')} aria-label="Cart" data-testid="button-cart"><ShoppingBag size={18} strokeWidth={1.8} /><span className="count">{cartCount}</span></button>
            <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu" data-testid="button-menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {menuOpen && (
          <div className="container mobile-nav">
            <button onClick={() => nav('/')} data-testid="mobile-link-home">Home</button>
            <button onClick={() => nav('/shop')} data-testid="mobile-link-shop">Shop all</button>
            <button onClick={() => nav('/wishlist')} data-testid="mobile-link-wishlist">Saved for later</button>
            <button onClick={() => nav('/cart')} data-testid="mobile-link-cart">Your bag ({cartCount})</button>
          </div>
        )}
      </header>
    </>
  );
}

function Hero({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <div className="eyebrow">A small Algerian bookstore, online</div>
          <h1>Your next favorite book <em>is waiting.</em></h1>
          <p className="hero-copy">Thoughtfully picked stories for slow mornings, long commutes, and the chapters of life you didn&apos;t see coming.</p>
          <div className="hero-buttons">
            <button className="btn btn-primary" onClick={() => onNavigate('/shop')} data-testid="button-hero-shop">Browse the shelves <ArrowRight size={15} /></button>
            <button className="btn btn-soft" onClick={() => onNavigate('/shop?category=Romance')} data-testid="button-hero-romance">I need a love story</button>
          </div>
          <div className="hero-note"><Truck size={14} /> Delivery everywhere in Algeria · Pay when it arrives</div>
        </div>
        <div className="shelf-scene" aria-label="A selection of books on a shelf">
          <span className="spark one"><Sparkles size={21} /></span><span className="spark two"><Sparkles size={16} /></span>
          <div className="sticker">currently<br />reading<br /><strong>♡</strong></div>
          <div className="book-stack">
            <div className="book book-lilac small"><span>the little things</span><strong>small<br />joys</strong><span>kame&apos;s pick</span></div>
            <div className="book book-pink tall"><span>prototype cover</span><strong>The<br />midnight<br />library</strong><span>Matt Haig</span><span className="book-mark" /></div>
            <div className="book book-green"><span>notes for<br />soft days</span><strong>the<br />comfort<br />book</strong><span>Matt Haig</span></div>
            <div className="book book-plum small"><span>read more<br />feel more</span><strong>stories<br />to keep</strong><span>Vol. 01</span></div>
          </div>
          <div className="shelf" />
        </div>
      </div>
    </section>
  );
}

function BookCard({
  product,
  isLoved,
  onToggleWish,
  onAdd,
  onOpen,
}: {
  product: Product;
  isLoved: boolean;
  onToggleWish: (id: string) => void;
  onAdd: (product: Product) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <article className="book-card" data-testid={`card-product-${product.id}`}>
      <button className={`heart-btn ${isLoved ? 'loved' : ''}`} onClick={() => onToggleWish(product.id)} aria-label={isLoved ? `Remove ${product.title} from wishlist` : `Save ${product.title}`} data-testid={`button-wishlist-${product.id}`}>
        <Heart size={17} fill={isLoved ? 'currentColor' : 'none'} />
      </button>
       <button className="cover-wrap" onClick={() => onOpen(product.id)} aria-label={`View ${product.title}`} data-testid={`button-open-book-${product.id}`}>
        <Cover product={product} />
      </button>
      <div className="book-info">
        <button onClick={() => onOpen(product.id)} data-testid={`link-book-${product.id}`}><h3>{product.title}</h3></button>
        <p>{product.author} · {product.category}</p>
        <div className="book-bottom"><span className="price">{formatDzd(product.price)} <small>COD</small></span><button className="add-btn" onClick={() => onAdd(product)} data-testid={`button-add-${product.id}`}>Add to bag</button></div>
      </div>
    </article>
  );
}

function CategoryStrip({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="section" style={{ paddingTop: 30, paddingBottom: 70 }}>
      <div className="container">
        <div className="section-heading">
          <div><div className="eyebrow">Pick a feeling</div><h2>What are you in the mood for?</h2></div>
          <p>Some days call for a page-turner. Some days call for a soft place to land.</p>
        </div>
        <div className="category-row">
          {categories.slice(1).map((category) => <button className="category-pill" key={category.name} onClick={() => onNavigate(`/shop?category=${encodeURIComponent(category.name)}`)} data-testid={`button-category-${category.name.toLowerCase().replace(' ', '-')}`}><span className="category-icon">{category.icon}</span>{category.name}<ChevronRight size={14} /></button>)}
        </div>
      </div>
    </section>
  );
}

function FeaturedBooks({
  products,
  wishlist,
  onToggleWish,
  onAdd,
  onOpen,
  onNavigate,
}: {
  products: Product[];
  wishlist: string[];
  onToggleWish: (id: string) => void;
  onAdd: (product: Product) => void;
  onOpen: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const featured = products.filter((product) => product.featured).slice(0, 4);
  return (
    <section className="section section-alt">
      <div className="container">
        <div className="section-heading">
          <div><div className="eyebrow">From our little pile</div><h2>Books we&apos;re talking about.</h2></div>
          <button className="text-link" onClick={() => onNavigate('/shop')} data-testid="link-see-all">See all books <ArrowRight size={14} /></button>
        </div>
        <div className="book-grid">
          {featured.map((product) => <BookCard key={product.id} product={product} isLoved={wishlist.includes(product.id)} onToggleWish={onToggleWish} onAdd={onAdd} onOpen={onOpen} />)}
        </div>
      </div>
    </section>
  );
}

function EditorialBlock({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="section">
      <div className="container editorial">
        <div className="editorial-art"><div className="editorial-book"><span>the kame&apos;s note</span><strong>Take your time.</strong><span>there is no prize for reading in a hurry</span></div></div>
        <div className="editorial-copy">
          <div className="eyebrow">The Kame&apos;s way</div>
          <h2>Books chosen like recommendations from a friend.</h2>
          <p>We started with a stack of favourites, a cozy corner on Instagram, and a lot of messages asking “where can I find this one?” Now our shelves travel from Algiers to your doorstep.</p>
          <div className="quote">“A bookshop should help you find the book you need — even when you don&apos;t know what it is yet.”</div>
          <div style={{ marginTop: 25 }}><button className="btn btn-outline" onClick={() => onNavigate('/shop')} data-testid="button-explore-shelves">Explore the shelves <ArrowRight size={15} /></button></div>
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section className="section section-alt">
      <div className="container">
        <div className="section-heading"><div><div className="eyebrow">Dog-eared and loved</div><h2>What readers are saying.</h2></div><div className="stars">★★★★★ <span className="muted">from our little community</span></div></div>
        <div className="review-grid">
          <div className="review-card featured"><div className="stars">★★★★★</div><p>“My order arrived wrapped so sweetly I almost didn&apos;t want to open it. Almost. The recommendations were perfect.”</p><div className="reviewer"><span className="avatar">SA</span><span><strong>Sarra A.</strong><br />Algiers · verified reader</span></div></div>
          <div className="review-card"><div className="stars">★★★★★</div><p>“Finally a place that makes choosing my next book feel like a conversation.”</p><div className="reviewer"><span className="avatar">YN</span><span><strong>Yasmine N.</strong><br />Oran · verified reader</span></div></div>
          <div className="review-card"><div className="stars">★★★★★</div><p>“The COD delivery was easy, and the little bookmark is now living in three different books.”</p><div className="reviewer"><span className="avatar">IK</span><span><strong>Imane K.</strong><br />Blida · verified reader</span></div></div>
        </div>
      </div>
    </section>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); if (email.trim().includes('@')) setSubscribed(true); };
  return (
    <section className="newsletter">
      <div className="container"><div className="newsletter-inner"><div><div className="eyebrow" style={{ color: 'hsl(338 48% 76%)' }}>A note from the shelves</div><h2>Good books, once in a while.</h2><p>New arrivals, honest little reviews, and reading rituals for your inbox. No noise. Unsubscribe whenever you like.</p>{subscribed && <div className="success-note" data-testid="status-newsletter-success"><Check size={14} style={{ verticalAlign: 'middle' }} /> You&apos;re on the list. See you in your inbox.</div>}</div><form className="newsletter-form" onSubmit={submit}><Mail size={16} style={{ display: 'none' }} /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="your@email.com" aria-label="Email address" required data-testid="input-newsletter-email" /><button className="btn" type="submit" data-testid="button-newsletter-submit">Keep me posted</button></form></div></div>
    </section>
  );
}

function Home({ products, wishlist, onToggleWish, onAdd, onOpen, onNavigate }: { products: Product[]; wishlist: string[]; onToggleWish: (id: string) => void; onAdd: (product: Product) => void; onOpen: (id: string) => void; onNavigate: (path: string) => void }) {
  return <><Hero onNavigate={onNavigate} /><CategoryStrip onNavigate={onNavigate} /><FeaturedBooks products={products} wishlist={wishlist} onToggleWish={onToggleWish} onAdd={onAdd} onOpen={onOpen} onNavigate={onNavigate} /><EditorialBlock onNavigate={onNavigate} /><Reviews /><Newsletter /></>;
}

function Shop({ products, wishlist, onToggleWish, onAdd, onOpen, onNavigate }: { products: Product[]; wishlist: string[]; onToggleWish: (id: string) => void; onAdd: (product: Product) => void; onOpen: (id: string) => void; onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [sort, setSort] = useState('featured');
  useEffect(() => {
    const categoryParam = new URLSearchParams(window.location.search).get('category') as Category | null;
    if (categoryParam && categories.some((item) => item.name === categoryParam)) setCategory(categoryParam);
  }, []);
  const visible = useMemo(() => products.filter((product) => (category === 'All' || product.category === category) && `${product.title} ${product.author}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : Number(b.featured) - Number(a.featured)), [category, query, sort, products]);
  return (
    <main>
       <div className="container page-header"><div className="eyebrow">The online shelves</div><h1>Find your next<br /><em style={{ color: 'hsl(338 48% 62%)' }}>favorite.</em></h1><p>Stories we&apos;ve loved, passed along, and kept close. A few of our real shelf favourites are waiting here for you.</p></div>
      <div className="container"><div className="shop-toolbar"><div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or author…" aria-label="Search books" data-testid="input-shop-search" /></div><div style={{ display: 'flex', gap: 8 }}><select className="select" value={category} onChange={(event) => setCategory(event.target.value as Category)} aria-label="Filter by category" data-testid="select-category">{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select><select className="select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort books" data-testid="select-sort"><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div></div>{visible.length > 0 ? <div className="book-grid" style={{ paddingBottom: 85 }}>{visible.map((product) => <BookCard key={product.id} product={product} isLoved={wishlist.includes(product.id)} onToggleWish={onToggleWish} onAdd={onAdd} onOpen={onOpen} />)}</div> : <div className="wishlist-empty"><Search className="empty-icon" size={34} /><h2 className="empty-title">Nothing on this exact page.</h2><p className="empty-copy">Try another title, author, or category. The shelves are a little shy today.</p><button className="btn btn-primary" onClick={() => { setQuery(''); setCategory('All'); }} data-testid="button-clear-search">Show everything</button></div>}</div>
    </main>
  );
}

function ProductDetail({ product, isLoved, onToggleWish, onAdd, onNavigate }: { product: Product; isLoved: boolean; onToggleWish: (id: string) => void; onAdd: (product: Product) => void; onNavigate: (path: string) => void }) {
  return (
    <main className="detail"><div className="container"><button className="back-link" onClick={() => onNavigate('/shop')} data-testid="button-back-shop"><ArrowLeft size={14} /> Back to the shelves</button><div className="detail-grid"><div className="detail-visual"><Cover product={product} large /><span className="sticker">a good<br />one ♡</span></div><div><div className="eyebrow">{product.category} · Kame&apos;s pick</div><h1>{product.title}</h1><div className="detail-author">by {product.author}</div><div className="detail-stats"><span className="stat"><BookOpen size={12} style={{ verticalAlign: 'middle' }} /> {product.pages} pages</span><span className="stat">{product.format}</span><span className="stat"><Truck size={12} style={{ verticalAlign: 'middle' }} /> COD available</span></div><p className="detail-desc">{product.description}</p><div className="detail-purchase"><span className="price">{formatDzd(product.price)} <small>· delivery calculated at checkout</small></span><button className="btn btn-primary" onClick={() => onAdd(product)} data-testid="button-detail-add">Add to bag <ShoppingBag size={15} /></button><button className={`heart-btn ${isLoved ? 'loved' : ''}`} style={{ position: 'static' }} onClick={() => onToggleWish(product.id)} aria-label="Save this book" data-testid="button-detail-wishlist"><Heart size={18} fill={isLoved ? 'currentColor' : 'none'} /></button></div><div className="delivery-note"><MapPin size={13} style={{ verticalAlign: 'middle' }} /> Delivered with care across Algeria · usually 2–5 working days · payment on arrival.</div></div></div></div></main>
  );
}

function Wishlist({ products, wishlist, onToggleWish, onAdd, onOpen, onNavigate }: { products: Product[]; wishlist: string[]; onToggleWish: (id: string) => void; onAdd: (product: Product) => void; onOpen: (id: string) => void; onNavigate: (path: string) => void }) {
  const saved = products.filter((product) => wishlist.includes(product.id));
  return <main><div className="container page-header"><div className="eyebrow">Your quiet corner</div><h1>Saved for<br /><em style={{ color: 'hsl(338 48% 62%)' }}>later.</em></h1><p>Books you&apos;re not ready to forget. Keep them here until the timing feels right.</p></div><div className="container" style={{ paddingBottom: 90 }}>{saved.length ? <div className="book-grid">{saved.map((product) => <BookCard key={product.id} product={product} isLoved onToggleWish={onToggleWish} onAdd={onAdd} onOpen={onOpen} />)}</div> : <div className="wishlist-empty"><Heart className="empty-icon" size={35} /><h2 className="empty-title">Your saved shelf is waiting.</h2><p className="empty-copy">Tap the little heart on a book that makes you curious. It&apos;ll stay here for later.</p><button className="btn btn-primary" onClick={() => onNavigate('/shop')} data-testid="button-wishlist-shop">Browse books <ArrowRight size={15} /></button></div>}</div></main>;
}

function Cart({ products, cart, onQuantity, onRemove, onNavigate }: { products: Product[]; cart: CartLine[]; onQuantity: (id: string, delta: number) => void; onRemove: (id: string) => void; onNavigate: (path: string) => void }) {
  const subtotal = cart.reduce((sum, line) => sum + (products.find((product) => product.id === line.id)?.price ?? 0) * line.quantity, 0);
  const delivery = subtotal === 0 ? 0 : 600;
  return <main><div className="container page-header"><div className="eyebrow">Your reading pile</div><h1>The bag.</h1><p>Everything you&apos;re taking home. We&apos;ll send it with care and collect payment when it arrives.</p></div><div className="container" style={{ paddingBottom: 90 }}>{cart.length ? <div className="cart-layout"><div className="cart-list">{cart.map((line) => { const product = products.find((item) => item.id === line.id); if (!product) return null; return <div className="cart-item" key={line.id} data-testid={`cart-item-${line.id}`}><div className="mini-cover">{product.coverImage ? <img src={product.coverImage} alt="" /> : <span>{product.title}</span>}</div><div><h3>{product.title}</h3><p>{product.author}</p><div className="quantity"><button onClick={() => onQuantity(line.id, -1)} aria-label="Decrease quantity" data-testid={`button-decrease-${line.id}`}><Minus size={13} /></button><span data-testid={`text-quantity-${line.id}`}>{line.quantity}</span><button onClick={() => onQuantity(line.id, 1)} aria-label="Increase quantity" data-testid={`button-increase-${line.id}`}><Plus size={13} /></button></div></div><div className="item-price"><strong>{formatDzd(product.price * line.quantity)}</strong><button className="remove" onClick={() => onRemove(line.id)} data-testid={`button-remove-${line.id}`}><Trash2 size={13} /> Remove</button></div></div>; })}</div><aside className="summary"><h2>Order summary</h2><div className="summary-row"><span>Books</span><strong>{formatDzd(subtotal)}</strong></div><div className="summary-row"><span>Delivery</span><strong>{delivery === 0 ? '—' : `${formatDzd(600)} home · ${formatDzd(400)} desk`}</strong></div><div className="summary-row total"><span>Total</span><strong>{formatDzd(subtotal + delivery)}</strong></div><button className="btn btn-primary" onClick={() => onNavigate('/checkout')} data-testid="button-checkout">Continue to checkout <ArrowRight size={15} /></button><p className="delivery-note"><Truck size={13} style={{ verticalAlign: 'middle' }} /> Shipping: 600 DA home delivery · 400 DA stop desk. COD everywhere.</p></aside></div> : <div className="cart-empty"><ShoppingBag className="empty-icon" size={35} /><h2 className="empty-title">Your bag is still dreaming.</h2><p className="empty-copy">Add a book or two and we&apos;ll get them ready for their trip to you.</p><button className="btn btn-primary" onClick={() => onNavigate('/shop')} data-testid="button-cart-shop">Find a book <ArrowRight size={15} /></button></div>}</div></main>;
}

function Checkout({ products, cart, onNavigate, onClearCart }: { products: Product[]; cart: CartLine[]; onNavigate: (path: string) => void; onClearCart: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilayaCode, setWilayaCode] = useState(0);
  const [commune, setCommune] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('home');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');
  const wilaya = WILAYAS.find((item) => item.code === wilayaCode);
  const subtotal = cart.reduce((sum, line) => sum + (products.find((product) => product.id === line.id)?.price ?? 0) * line.quantity, 0);
  const delivery = deliveryMethod === 'home' ? HOME_DELIVERY_FEE : STOPDESK_DELIVERY_FEE;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (placing || !wilaya) return;
    setPlacing(true);
    setError('');
    try {
      const id = await placeOrder(getCartToken(), {
        name, phone, wilayaCode: wilaya.code, commune,
        deliveryMethod, address, notes,
      });
      setOrderId(id);
      onClearCart();
    } catch {
      setError('Something went wrong placing your order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };
  if (orderId) return <main className="detail"><div className="container success-state"><div className="success-circle"><Check size={30} /></div><div className="eyebrow" style={{ marginTop: 22 }}>It&apos;s on its way</div><h1>Thank you for<br /><em style={{ color: 'hsl(338 48% 62%)' }}>trusting our shelves.</em></h1><p className="empty-copy">Your order is tucked away safely. We&apos;ll call you soon on {phone} to confirm delivery — payment happens when your books arrive.</p><button className="btn btn-primary" onClick={() => onNavigate('/shop')} data-testid="button-success-shop">Keep browsing <ArrowRight size={15} /></button></div></main>;
  const methodCard = (value: DeliveryMethod, title: string, hint: string, testid: string) => (
    <button
      type="button"
      onClick={() => setDeliveryMethod(value)}
      className="field"
      style={{
        border: deliveryMethod === value ? '1.5px solid hsl(338 48% 62%)' : '1px solid hsl(var(--border))',
        borderRadius: 10,
        padding: '13px 15px',
        textAlign: 'left',
        background: deliveryMethod === value ? 'hsl(338 48% 97%)' : 'transparent',
        cursor: 'pointer',
      }}
      data-testid={testid}
    >
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{hint}</span>
    </button>
  );
  return <main><div className="container page-header"><div className="eyebrow">Almost yours</div><h1>Checkout, <em style={{ color: 'hsl(338 48% 62%)' }}>gently.</em></h1><p>No account, no card details. Just tell us where to send your books and pay when they arrive.</p></div><div className="container checkout-layout" style={{ paddingBottom: 90 }}><form className="form-card" onSubmit={submit}><h2>Delivery details</h2><div className="form-grid"><div className="field"><label htmlFor="checkout-name">Full name</label><input id="checkout-name" name="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" data-testid="input-checkout-name" /></div><div className="field"><label htmlFor="checkout-phone">Phone number</label><input id="checkout-phone" name="phone" required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0555 12 34 56" data-testid="input-checkout-phone" /></div><div className="field"><label htmlFor="checkout-wilaya">Wilaya</label><select id="checkout-wilaya" required value={wilayaCode || ''} onChange={(event) => { setWilayaCode(Number(event.target.value)); setCommune(''); }} data-testid="select-checkout-wilaya"><option value="" disabled>Search or choose your wilaya</option>{WILAYAS.map((item) => <option key={item.code} value={item.code}>{String(item.code).padStart(2, '0')} — {item.name}</option>)}</select></div><div className="field"><label htmlFor="checkout-commune">City / Commune</label><select id="checkout-commune" required disabled={!wilaya} value={commune} onChange={(event) => setCommune(event.target.value)} data-testid="select-checkout-commune"><option value="" disabled>{wilaya ? 'Choose your commune' : 'Choose your wilaya first'}</option>{(wilaya?.communes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="field full"><label>Delivery method</label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{methodCard('home', 'Home delivery', 'We bring it to your door.', 'button-method-home')}{methodCard('stopdesk', 'Stop desk', 'You pick it up at a delivery office.', 'button-method-stopdesk')}</div></div>{deliveryMethod === 'home' && <div className="field full"><label htmlFor="checkout-address">Delivery address</label><input id="checkout-address" name="address" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, building, helpful landmark…" data-testid="input-checkout-address" /></div>}<div className="field full"><label htmlFor="checkout-note">A note for the delivery person <span className="muted">(optional)</span></label><input id="checkout-note" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Call me before arriving…" data-testid="input-checkout-note" /></div></div>{error && <p style={{ marginTop: 14, fontSize: 12, color: 'hsl(0 60% 45%)' }} data-testid="status-checkout-error">{error}</p>}<div style={{ marginTop: 25, paddingTop: 18, borderTop: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))', fontSize: 11 }}><Clock3 size={13} style={{ verticalAlign: 'middle' }} /> We&apos;ll confirm your order by phone before dispatching.</div><button className="btn btn-primary" style={{ marginTop: 20, width: '100%' }} type="submit" disabled={placing} data-testid="button-place-order">{placing ? 'Placing your order…' : `Place my order · ${formatDzd(subtotal + delivery)}`} <ArrowRight size={15} /></button></form><aside className="summary"><h2>Your books</h2>{cart.map((line) => { const product = products.find((item) => item.id === line.id); return product ? <div className="summary-row" key={line.id}><span>{product.title} × {line.quantity}</span><strong>{formatDzd(product.price * line.quantity)}</strong></div> : null; })}<div className="summary-row"><span>Shipping</span><strong>{formatDzd(delivery)}</strong></div><div className="summary-row total"><span>Total</span><strong>{formatDzd(subtotal + delivery)}</strong></div><p className="delivery-note"><Check size={13} style={{ verticalAlign: 'middle' }} /> Cash on delivery · no payment needed today.</p></aside></div></main>;
}

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const LOW_STOCK_THRESHOLD = 5;

const adminInputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 13, width: '100%', background: 'white' };

function CategoryForm({ category, session, onDone, onError }: {
  category: AdminCategory | 'new';
  session: AdminSession;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const isNew = category === 'new';
  const [name, setName] = useState(isNew ? '' : category.name);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) return;
    try {
      if (isNew) await createCategory(session, name.trim(), slug);
      else await updateCategory(session, category.id, { name: name.trim(), slug });
      onDone(isNew ? 'Category added' : 'Category saved');
    } catch {
      onError('Something went wrong. Please try again.');
    }
  };
  return <form onSubmit={submit} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', border: '1px solid hsl(var(--border))', borderRadius: 12 }} data-testid={isNew ? 'form-category-new' : `form-category-${category.id}`}>
    <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" style={adminInputStyle} data-testid={isNew ? 'input-category-name-new' : `input-category-name-${category.id}`} />
    <button className="btn btn-primary" type="submit" style={{ padding: '8px 14px', fontSize: 12 }} data-testid={isNew ? 'button-category-save-new' : `button-category-save-${category.id}`}>Save</button>
    <button type="button" onClick={() => onDone('')} style={{ fontSize: 12, cursor: 'pointer', border: 'none', background: 'none' }}>Cancel</button>
  </form>;
}

function BookForm({ book, categories, session, onDone, onError }: {
  book: AdminBook | 'new';
  categories: AdminCategory[];
  session: AdminSession;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const isNew = book === 'new';
  const [form, setForm] = useState({
    title: isNew ? '' : book.title, author: isNew ? '' : book.author, description: isNew ? '' : book.description,
    price: isNew ? '' : String(book.price), category_id: isNew ? (categories[0]?.id ?? '') : book.category_id,
    pages: isNew ? '' : String(book.pages ?? ''), format: isNew ? 'paperback' : book.format,
    stock: isNew ? '0' : String(book.stock), cover_url: isNew ? '' : (book.cover_url ?? ''),
    featured: isNew ? false : book.featured, active: isNew ? true : book.active,
  });
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const [uploading, setUploading] = useState(false);
  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      set('cover_url', await uploadCoverImage(session, file));
    } catch {
      onError('Cover upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: BookInput = {
      title: form.title.trim(), author: form.author.trim(), description: form.description.trim() || 'A lovely read.',
      price: Math.max(1, Number(form.price)), category_id: form.category_id,
      pages: form.pages ? Number(form.pages) : null, format: form.format as 'paperback' | 'hardcover',
      stock: Math.max(0, Number(form.stock)), cover_url: form.cover_url.trim() || null,
      featured: form.featured, active: form.active,
    };
    try {
      if (isNew) await createBook(session, payload);
      else await updateBook(session, book.id, payload);
      onDone(isNew ? 'Book added to the shelves' : 'Book saved');
    } catch {
      onError('Something went wrong. Please try again.');
    }
  };
  return <form onSubmit={submit} className="form-card" data-testid={isNew ? 'form-book-new' : `form-book-${book.id}`}>
    <h2 style={{ fontSize: 15 }}>{isNew ? 'A new book' : `Editing \u201c${book.title}\u201d`}</h2>
    <div className="form-grid">
      <div className="field"><label>Title</label><input required value={form.title} onChange={(event) => set('title', event.target.value)} style={adminInputStyle} data-testid={isNew ? 'input-book-title-new' : `input-book-title-${book.id}`} /></div>
      <div className="field"><label>Author</label><input required value={form.author} onChange={(event) => set('author', event.target.value)} style={adminInputStyle} data-testid={isNew ? 'input-book-author-new' : `input-book-author-${book.id}`} /></div>
      <div className="field"><label>Price (DA)</label><input required type="number" min="1" value={form.price} onChange={(event) => set('price', event.target.value)} style={adminInputStyle} data-testid={isNew ? 'input-book-price-new' : `input-book-price-${book.id}`} /></div>
      <div className="field"><label>Category</label><select required value={form.category_id} onChange={(event) => set('category_id', event.target.value)} style={adminInputStyle} data-testid={isNew ? 'select-book-category-new' : `select-book-category-${book.id}`}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <div className="field"><label>Stock</label><input required type="number" min="0" value={form.stock} onChange={(event) => set('stock', event.target.value)} style={adminInputStyle} data-testid={isNew ? 'input-book-stock-new' : `input-book-stock-${book.id}`} /></div>
      <div className="field"><label>Pages (optional)</label><input type="number" min="1" value={form.pages} onChange={(event) => set('pages', event.target.value)} style={adminInputStyle} /></div>
      <div className="field"><label>Format</label><select value={form.format} onChange={(event) => set('format', event.target.value)} style={adminInputStyle}>{['paperback', 'hardcover'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="field full"><label>Cover image URL (optional)</label><input value={form.cover_url} onChange={(event) => set('cover_url', event.target.value)} placeholder="https://…" style={adminInputStyle} data-testid={isNew ? 'input-book-cover-new' : `input-book-cover-${book.id}`} /></div>
      <div className="field full"><label>Or upload a cover image</label><input type="file" accept="image/*" onChange={uploadCover} disabled={uploading} style={{ fontSize: 12 }} data-testid={isNew ? 'input-book-cover-file-new' : `input-book-cover-file-${book.id}`} />{uploading && <span className="muted" style={{ fontSize: 11 }}>Uploading…</span>}</div>
      <div className="field full"><label>Description</label><textarea value={form.description} onChange={(event) => set('description', event.target.value)} rows={3} style={{ ...adminInputStyle, resize: 'vertical' }} data-testid={isNew ? 'input-book-desc-new' : `input-book-desc-${book.id}`} /></div>
      <div className="field" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={form.featured} onChange={(event) => set('featured', event.target.checked)} /> Featured</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={form.active} onChange={(event) => set('active', event.target.checked)} /> On the shelves</label>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
      <button className="btn btn-primary" type="submit" data-testid={isNew ? 'button-book-save-new' : `button-book-save-${book.id}`}>{isNew ? 'Add to the shelves' : 'Save changes'}</button>
      <button type="button" onClick={() => onDone('')} style={{ fontSize: 13, cursor: 'pointer', border: 'none', background: 'none' }}>Cancel</button>
    </div>
  </form>;
}

function Admin({ section }: { section: string }) {
  const [session, setSession] = useState<AdminSession | null>(() => getAdminSession());
  const [localPath, setLocalPath] = useState(section);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [books, setBooks] = useState<AdminBook[] | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState('');
  const [editingBook, setEditingBook] = useState<AdminBook | 'new' | null>(null);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | 'new' | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [orderSort, setOrderSort] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [bookSearch, setBookSearch] = useState('');

  useEffect(() => { setLocalPath(section); }, [section]);
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(''), 2500); return () => window.clearTimeout(timer); }, [message]);

  const load = async (activeSession: AdminSession) => {
    setLoadError(false);
    try {
      const [bookRows, categoryRows, orderRows] = await Promise.all([
        fetchAdminBooks(activeSession),
        fetchAdminCategories(activeSession),
        fetchAllOrders(activeSession),
      ]);
      setBooks(bookRows);
      setCategories(categoryRows);
      setOrders(orderRows);
    } catch {
      setLoadError(true);
    }
  };
  useEffect(() => {
    if (session) load(session);
  }, [session]);

  const run = async (action: () => Promise<void>, done: string) => {
    if (!session) return;
    try {
      await action();
      setMessage(done);
      await load(session);
    } catch (err) {
      setMessage(err instanceof Error && err.message.includes('delete failed')
        ? 'That can\u2019t be deleted — products or orders still use it.'
        : 'Something went wrong. Please try again.');
    }
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    setError('');
    try {
      setSession(await adminSignIn(email, password));
      setPassword('');
    } catch {
      setError('That email or password didn\u2019t match. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  if (!session) return <main className="detail"><div className="container" style={{ maxWidth: 430, paddingTop: 60, paddingBottom: 120 }}><div className="form-card"><h2>Back office</h2><p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 18 }}>The little counter where Kame keeps track of everything.</p><form onSubmit={signIn}><div className="field"><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" data-testid="input-admin-email" /></div><div className="field"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" data-testid="input-admin-password" /></div>{error && <p style={{ marginTop: 14, fontSize: 12, color: 'hsl(0 60% 45%)' }} data-testid="status-admin-error">{error}</p>}<button className="btn btn-primary" style={{ marginTop: 20, width: '100%' }} type="submit" disabled={signingIn} data-testid="button-admin-signin">{signingIn ? 'Checking…' : 'Sign in'} <ArrowRight size={15} /></button></form></div></div></main>;

  const view = localPath.replace(/\/admin\/?/, '') || 'dashboard';
  const navItems: Array<{ key: string; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'products', label: 'Products' },
    { key: 'categories', label: 'Categories' },
    { key: 'orders', label: 'Orders' },
  ];
  const go = (key: string) => {
    const next = key === 'dashboard' ? '/admin' : `/admin/${key}`;
    window.history.replaceState(null, '', next);
    setLocalPath(next);
    setEditingBook(null);
    setEditingCategory(null);
    window.scrollTo({ top: 0 });
  };
  const shell = (children: React.ReactNode) => (
    <main><div className="container" style={{ paddingTop: 30, paddingBottom: 90 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 190px) 1fr', gap: 28, alignItems: 'start' }}>
        <aside style={{ display: 'grid', gap: 6, position: 'sticky', top: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Back office</div>
          {navItems.map((item) => (
            <button key={item.key} type="button" onClick={() => go(item.key)}
              style={{ textAlign: 'left', padding: '9px 13px', borderRadius: 10, fontSize: 13, cursor: 'pointer', border: view === item.key ? '1.5px solid hsl(338 48% 62%)' : '1px solid transparent', background: view === item.key ? 'hsl(338 48% 97%)' : 'transparent' }}
              data-testid={`button-admin-nav-${item.key}`}>
              {item.label}
              {item.key === 'orders' && orders && orders.some((order) => order.status === 'pending') && <span style={{ marginLeft: 6, background: 'hsl(338 48% 62%)', color: 'white', borderRadius: 999, fontSize: 10, padding: '1px 7px' }}>{orders.filter((order) => order.status === 'pending').length}</span>}
            </button>
          ))}
          <button type="button" onClick={() => { adminSignOut(); setSession(null); setBooks(null); setOrders(null); }} style={{ textAlign: 'left', padding: '9px 13px', borderRadius: 10, fontSize: 13, cursor: 'pointer', border: '1px solid transparent', color: 'hsl(var(--muted-foreground))' }} data-testid="button-admin-signout">Sign out</button>
        </aside>
        <div>{children}</div>
      </div>
    </div>{message && <div className="toast" role="status" data-testid="status-admin-toast">{message}</div>}</main>
  );

  const statCard = (label: string, value: number, testid: string) => (
    <div className="admin-card" style={{ padding: 16 }} data-testid={testid}><div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div><div style={{ fontSize: 28, marginTop: 6 }}>{value}</div></div>
  );

  if (view === 'dashboard') {
    if (!books || !orders) return shell(<p className="empty-copy">{loadError ? 'Couldn\u2019t load the back office. Please refresh.' : 'Opening the ledger…'}</p>);
    const lowStock = books.filter((book) => book.active && book.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock);
    return shell(<>
      <h1 style={{ fontSize: 26, marginBottom: 18 }}>Good day, Kame.</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {statCard('Books on the shelves', books.filter((book) => book.active).length, 'stat-active-products')}
        {statCard('Running low', lowStock.length, 'stat-low-stock')}
        {statCard('Out of stock', books.filter((book) => book.active && book.stock === 0).length, 'stat-out-of-stock')}
        {statCard('Orders to confirm', orders.filter((order) => order.status === 'pending').length, 'stat-pending-orders')}
      </div>
      <h2 style={{ fontSize: 16, margin: '26px 0 10px' }}>Almost gone</h2>
      {lowStock.length === 0 ? <p className="empty-copy">Every shelf is comfortably stocked.</p> : <div style={{ display: 'grid', gap: 8 }}>{lowStock.map((book) => <div key={book.id} className="admin-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} data-testid={`row-low-${book.id}`}><span style={{ fontSize: 13 }}>{book.title}</span><strong style={{ fontSize: 12, color: book.stock === 0 ? 'hsl(0 60% 45%)' : 'hsl(33 60% 45%)' }}>{book.stock === 0 ? 'sold out' : `${book.stock} left`}</strong></div>)}</div>}
      <h2 style={{ fontSize: 16, margin: '26px 0 10px' }}>Latest orders</h2>
      {orders.length === 0 ? <p className="empty-copy">No orders yet — they\u2019ll appear here the moment one lands.</p> : <div style={{ display: 'grid', gap: 8 }}>{orders.slice(0, 5).map((order) => <div key={order.id} className="admin-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }} data-testid={`row-recent-${order.id}`}><button type="button" onClick={() => go('orders')} style={{ fontSize: 13, cursor: 'pointer', border: 'none', background: 'none' }}>{order.order_number} — {order.customer_name}</button><span style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}><strong>{formatDzd(order.total)}</strong><span className="muted">{order.status}</span></span></div>)}</div>}
    </>);
  }

  if (view === 'orders') {
    if (!orders) return shell(<p className="empty-copy">{loadError ? 'Couldn\u2019t load orders. Please refresh.' : 'Fetching orders…'}</p>);
    const visible = orders
      .filter((order) => orderStatusFilter === 'all' || order.status === orderStatusFilter)
      .filter((order) => {
        const q = orderSearch.trim().toLowerCase();
        return !q || order.customer_name.toLowerCase().includes(q) || order.customer_phone.includes(q) || order.order_number.toLowerCase().includes(q);
      })
      .sort((a, b) => orderSort === 'newest' ? b.created_at.localeCompare(a.created_at) : orderSort === 'oldest' ? a.created_at.localeCompare(b.created_at) : orderSort === 'highest' ? b.total - a.total : a.total - b.total);
    const changeStatus = async (order: AdminOrder, status: OrderStatus) => {
      if (status === order.status) return;
      const previous = orders;
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
      try {
        await updateOrderStatus(session, order.id, status);
        setMessage(`Order ${order.order_number} is now ${status}`);
      } catch {
        setOrders(previous);
        setMessage('Could not update that order. Please try again.');
      }
    };
    const orderCard = (order: AdminOrder) => (
      <div className="admin-card" key={order.id} data-testid={`card-order-${order.id}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 14 }} data-testid={`text-order-number-${order.id}`}>{order.order_number}</h2>
          <select value={order.status} onChange={(event) => changeStatus(order, event.target.value as OrderStatus)} data-testid={`select-status-${order.id}`} aria-label="Order status" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'white', fontSize: 12 }}>
            {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{new Date(order.created_at).toLocaleString()}</p>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="field"><span className="muted" style={{ fontSize: 11 }}>Customer</span><div style={{ fontSize: 13 }}>{order.customer_name} · {order.customer_phone}</div></div>
          <div className="field"><span className="muted" style={{ fontSize: 11 }}>Destination</span><div style={{ fontSize: 13 }}>{order.wilaya}, {order.commune} · {order.delivery_method === 'home' ? 'Home delivery' : 'Stop desk'}</div></div>
          {order.address && <div className="field full"><span className="muted" style={{ fontSize: 11 }}>Address</span><div style={{ fontSize: 13 }}>{order.address}</div></div>}
          {order.notes && <div className="field full"><span className="muted" style={{ fontSize: 11 }}>Note</span><div style={{ fontSize: 13 }}>{order.notes}</div></div>}
        </div>
        <div style={{ marginTop: 12, borderTop: '1px solid hsl(var(--border))', paddingTop: 10 }}>
          {order.order_items.map((item, index) => <div className="summary-row" key={index}><span>{item.title} × {item.quantity}</span><strong>{formatDzd(item.unit_price * item.quantity)}</strong></div>)}
          <div className="summary-row"><span>Shipping</span><strong>{formatDzd(order.delivery_fee)}</strong></div>
          <div className="summary-row total"><span>Total (COD)</span><strong data-testid={`text-total-${order.id}`}>{formatDzd(order.total)}</strong></div>
        </div>
      </div>
    );
    return shell(<>
      <h1 style={{ fontSize: 26, marginBottom: 14 }}>Orders</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['all', ...ORDER_STATUSES] as Array<'all' | OrderStatus>).map((status) => (
          <button key={status} type="button" onClick={() => setOrderStatusFilter(status)}
            style={{ padding: '5px 13px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: orderStatusFilter === status ? '1.5px solid hsl(338 48% 62%)' : '1px solid hsl(var(--border))', background: orderStatusFilter === status ? 'hsl(338 48% 97%)' : 'white', color: orderStatusFilter === status ? 'hsl(338 48% 40%)' : 'hsl(var(--foreground))' }}
            data-testid={`chip-status-${status}`}>
            {status === 'all' ? 'All' : status}
            {status !== 'all' && <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>{orders.filter((order) => order.status === status).length}</span>}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, marginBottom: 18 }}>
        <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search name, phone or order number…" style={adminInputStyle} data-testid="input-order-search" />
        <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value as 'all' | OrderStatus)} style={adminInputStyle} data-testid="select-order-status">
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={orderSort} onChange={(event) => setOrderSort(event.target.value as 'newest' | 'oldest' | 'highest' | 'lowest')} style={adminInputStyle} data-testid="select-order-sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="highest">Highest total</option>
          <option value="lowest">Lowest total</option>
        </select>
      </div>
      {visible.length === 0 ? <p className="empty-copy">No orders match.</p> : <div style={{ display: 'grid', gap: 18 }}>{visible.map(orderCard)}</div>}
    </>);
  }

  if (view === 'categories') {
    return shell(<>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 26 }}>Categories</h1>
        {editingCategory === null && <button className="btn btn-primary" onClick={() => setEditingCategory('new')} data-testid="button-category-new">New category</button>}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {editingCategory === 'new' && <CategoryForm category="new" session={session} onDone={(done) => { setEditingCategory(null); if (done) { setMessage(done); load(session); } }} onError={(msg) => { setEditingCategory(null); setMessage(msg); }} />}
        {categories.map((category) => (
          <div key={category.id}>
            {editingCategory && editingCategory !== 'new' && editingCategory.id === category.id ? (
              <CategoryForm category={category} session={session} onDone={(done) => { setEditingCategory(null); if (done) { setMessage(done); load(session); } }} onError={(msg) => { setEditingCategory(null); setMessage(msg); }} />
            ) : (
              <div className="admin-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }} data-testid={`row-category-${category.id}`}>
                <div><strong style={{ fontSize: 13 }}>{category.name}</strong><span className="muted" style={{ fontSize: 11, marginLeft: 10 }}>/{category.slug} · {books?.filter((book) => book.category_id === category.id).length ?? 0} books</span></div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" onClick={() => setEditingCategory(category)} style={{ fontSize: 12, cursor: 'pointer', border: 'none', background: 'none', textDecoration: 'underline' }} data-testid={`button-category-edit-${category.id}`}>Edit</button>
                  <button type="button" onClick={() => run(() => deleteCategory(session, category.id), 'Category deleted')} style={{ fontSize: 12, cursor: 'pointer', border: 'none', background: 'none', color: 'hsl(0 60% 45%)' }} data-testid={`button-category-delete-${category.id}`}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>);
  }

  // products
  if (!books) return shell(<p className="empty-copy">{loadError ? 'Couldn\u2019t load. Please refresh.' : 'Loading the shelves…'}</p>);
  const changeStock = (book: AdminBook, delta: number) => {
    const next = Math.max(0, book.stock + delta);
    setBooks((current) => current!.map((item) => item.id === book.id ? { ...item, stock: next } : item));
    run(() => updateBook(session, book.id, { stock: next }), next === 0 ? `${book.title} is now sold out` : `Stock of \u201c${book.title}\u201d updated`);
  };
  const bookQuery = bookSearch.trim().toLowerCase();
  const visibleBooks = bookQuery
    ? books.filter((book) => book.title.toLowerCase().includes(bookQuery) || book.author.toLowerCase().includes(bookQuery))
    : books;
  return shell(<>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
      <h1 style={{ fontSize: 26 }}>Products</h1>
      {editingBook === null && <button className="btn btn-primary" onClick={() => setEditingBook('new')} data-testid="button-book-new">New book</button>}
    </div>
    <div style={{ marginBottom: 14 }}>
      <input value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} placeholder="Search by title or author…" style={{ ...adminInputStyle, width: '100%', boxSizing: 'border-box' }} data-testid="input-product-search" />
    </div>
    <div style={{ display: 'grid', gap: 10 }}>
      {editingBook === 'new' && <BookForm book="new" categories={categories} session={session} onDone={(done) => { setEditingBook(null); if (done) { setMessage(done); load(session); } }} onError={(msg) => { setEditingBook(null); setMessage(msg); }} />}
      {visibleBooks.length === 0 && <p className="empty-copy">No books match \u201c{bookSearch.trim()}\u201d.</p>}
      {visibleBooks.map((book) => (
        <div key={book.id}>
          {editingBook && editingBook !== 'new' && editingBook.id === book.id ? (
            <BookForm book={book} categories={categories} session={session} onDone={(done) => { setEditingBook(null); if (done) { setMessage(done); load(session); } }} onError={(msg) => { setEditingBook(null); setMessage(msg); }} />
          ) : (
            <div className="admin-card" style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', opacity: book.active ? 1 : 0.55 }} data-testid={`row-book-${book.id}`}>
              <div className="admin-cover">{book.cover_url ? <img src={book.cover_url} alt="" /> : <span>{book.title.slice(0, 2)}</span>}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 13, display: 'block' }}>{book.title}{!book.active && <span className="muted"> · archived</span>}{book.featured && <span style={{ color: 'hsl(338 48% 62%)' }}> ★</span>}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{book.categories?.name ?? '—'} · {formatDzd(book.price)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => changeStock(book, -1)} aria-label="Decrease stock" style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid hsl(var(--border))', cursor: 'pointer', background: 'white' }} data-testid={`button-stock-minus-${book.id}`}>−</button>
                <span style={{ fontSize: 13, minWidth: 24, textAlign: 'center' }} data-testid={`text-stock-${book.id}`}>{book.stock}</span>
                <button type="button" onClick={() => changeStock(book, 1)} aria-label="Increase stock" style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid hsl(var(--border))', cursor: 'pointer', background: 'white' }} data-testid={`button-stock-plus-${book.id}`}>+</button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setEditingBook(book)} style={{ fontSize: 12, cursor: 'pointer', border: 'none', background: 'none', textDecoration: 'underline' }} data-testid={`button-book-edit-${book.id}`}>Edit</button>
                <button type="button" onClick={() => run(() => updateBook(session, book.id, { active: !book.active }), book.active ? `\u201c${book.title}\u201d archived` : `\u201c${book.title}\u201d is back on the shelves`)} style={{ fontSize: 12, cursor: 'pointer', border: 'none', background: 'none', textDecoration: 'underline' }} data-testid={`button-book-archive-${book.id}`}>{book.active ? 'Archive' : 'Restore'}</button>
                {!book.active && <button type="button" onClick={() => run(() => deleteBook(session, book.id), `\u201c${book.title}\u201d deleted forever`)} style={{ fontSize: 12, cursor: 'pointer', border: 'none', background: 'none', color: 'hsl(0 60% 45%)' }} data-testid={`button-book-delete-${book.id}`}>Delete</button>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  </>);
}

function Footer({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <footer className="footer"><div className="container footer-inner"><div><button className="brand" onClick={() => onNavigate('/')} data-testid="footer-link-home"><span className="brand-mark"><BookOpen size={16} /></span><span><span className="brand-name" style={{ fontSize: 18 }}>Kame&apos;s Shelves</span><span className="footer-note">A little bookstore from Algeria, with love.</span></span></button></div><div className="footer-links"><button onClick={() => onNavigate('/shop')} data-testid="footer-link-shop">Shop</button><button onClick={() => onNavigate('/wishlist')} data-testid="footer-link-wishlist">Wishlist</button><span><Instagram size={14} style={{ verticalAlign: 'middle' }} /> @kamesshelves</span></div></div></footer>;
}

function AppContent() {
  const [location, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [toast, setToast] = useState('');
  const cartTokenRef = useRef('');
  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((catalog) => { if (!cancelled) setProducts(catalog); })
      .catch(() => { if (!cancelled) setCatalogError(true); });
    cartTokenRef.current = getCartToken();
    fetchCart(cartTokenRef.current)
      .then((lines) => { if (!cancelled) setCart(lines); })
      .catch(() => {});
    fetchWishlist(cartTokenRef.current)
      .then((ids) => { if (!cancelled) setWishlist(ids); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2200); return () => window.clearTimeout(timer); }, [toast]);
  const navigate = (path: string) => { setLocation(path); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleWish = (id: string) => {
    const loved = wishlist.includes(id);
    setWishlist(loved ? wishlist.filter((item) => item !== id) : [...wishlist, id]);
    if (loved) deleteWishlistItem(cartTokenRef.current, id).catch(() => {});
    else addWishlistItem(cartTokenRef.current, id).catch(() => {});
    setToast(loved ? 'Removed from your saved shelf' : 'Saved for a good reading day');
  };
  const addToCart = (product: Product) => {
    const newQuantity = (cart.find((line) => line.id === product.id)?.quantity ?? 0) + 1;
    setCart(cart.some((line) => line.id === product.id)
      ? cart.map((line) => line.id === product.id ? { ...line, quantity: newQuantity } : line)
      : [...cart, { id: product.id, quantity: 1 }]);
    setCartItem(cartTokenRef.current, product.id, newQuantity).catch(() => {});
    setToast(`${product.title} added to your bag`);
  };
  const updateQuantity = (id: string, delta: number) => {
    const current = cart.find((line) => line.id === id)?.quantity ?? 1;
    const newQuantity = Math.max(1, current + delta);
    setCart(cart.map((line) => line.id === id ? { ...line, quantity: newQuantity } : line));
    setCartItem(cartTokenRef.current, id, newQuantity).catch(() => {});
  };
  const removeLine = (id: string) => { setCart((current) => current.filter((line) => line.id !== id)); deleteCartItem(cartTokenRef.current, id).catch(() => {}); setToast('Removed from your bag'); };
  const path = location.split('?')[0];
  const detailId = path.match(/^\/book\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
  const detailProduct = detailId ? products?.find((product) => product.id === detailId) : undefined;
  if (path.startsWith('/admin')) return <Admin section={path} />;
  if (!products) return <div className="app-shell"><Header location={location} cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} wishlistCount={wishlist.length} onNavigate={navigate} /><main><div className="container page-header"><div className="eyebrow">The online shelves</div><h1>{catalogError ? 'The shelves are unreachable.' : 'Opening the shelves…'}</h1><p>{catalogError ? 'Something went wrong fetching our books. Please refresh the page in a moment.' : 'One second while we fetch the books for you.'}</p>{catalogError && <button className="btn btn-primary" onClick={() => window.location.reload()} data-testid="button-retry-catalog">Try again</button>}</div></main><Footer onNavigate={navigate} /></div>;
  const page = path === '/' ? <Home products={products} wishlist={wishlist} onToggleWish={toggleWish} onAdd={addToCart} onOpen={(id) => navigate(`/book/${id}`)} onNavigate={navigate} /> : path === '/shop' ? <Shop products={products} wishlist={wishlist} onToggleWish={toggleWish} onAdd={addToCart} onOpen={(id) => navigate(`/book/${id}`)} onNavigate={navigate} /> : path === '/wishlist' ? <Wishlist products={products} wishlist={wishlist} onToggleWish={toggleWish} onAdd={addToCart} onOpen={(id) => navigate(`/book/${id}`)} onNavigate={navigate} /> : path === '/cart' ? <Cart products={products} cart={cart} onQuantity={updateQuantity} onRemove={removeLine} onNavigate={navigate} /> : path === '/checkout' ? <Checkout products={products} cart={cart} onNavigate={navigate} onClearCart={() => { setCart([]); clearCartItems(cartTokenRef.current).catch(() => {}); }} /> : detailProduct ? <ProductDetail product={detailProduct} isLoved={wishlist.includes(detailProduct.id)} onToggleWish={toggleWish} onAdd={addToCart} onNavigate={navigate} /> : <Wishlist products={products} wishlist={[]} onToggleWish={toggleWish} onAdd={addToCart} onOpen={(id) => navigate(`/book/${id}`)} onNavigate={() => navigate('/')} />;
  return <div className="app-shell"><Header location={location} cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} wishlistCount={wishlist.length} onNavigate={navigate} />{page}<Footer onNavigate={navigate} />{toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}</div>;
}

export default function App() {
  return <AppContent />;
}