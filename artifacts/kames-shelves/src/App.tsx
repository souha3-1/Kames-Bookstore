import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { fetchCatalog, getCartToken, fetchCart, setCartItem, deleteCartItem, clearCartItems, fetchWishlist, addWishlistItem, deleteWishlistItem, type Product, type CartLine } from './lib/supabase';
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
      <div className="announcement">Free delivery in Algiers from 4,000 DA · Cash on delivery across Algeria</div>
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
  const delivery = subtotal === 0 ? 0 : subtotal >= 4000 ? 0 : 500;
  return <main><div className="container page-header"><div className="eyebrow">Your reading pile</div><h1>The bag.</h1><p>Everything you&apos;re taking home. We&apos;ll send it with care and collect payment when it arrives.</p></div><div className="container" style={{ paddingBottom: 90 }}>{cart.length ? <div className="cart-layout"><div className="cart-list">{cart.map((line) => { const product = products.find((item) => item.id === line.id); if (!product) return null; return <div className="cart-item" key={line.id} data-testid={`cart-item-${line.id}`}><div className="mini-cover">{product.coverImage ? <img src={product.coverImage} alt="" /> : <span>{product.title}</span>}</div><div><h3>{product.title}</h3><p>{product.author}</p><div className="quantity"><button onClick={() => onQuantity(line.id, -1)} aria-label="Decrease quantity" data-testid={`button-decrease-${line.id}`}><Minus size={13} /></button><span data-testid={`text-quantity-${line.id}`}>{line.quantity}</span><button onClick={() => onQuantity(line.id, 1)} aria-label="Increase quantity" data-testid={`button-increase-${line.id}`}><Plus size={13} /></button></div></div><div className="item-price"><strong>{formatDzd(product.price * line.quantity)}</strong><button className="remove" onClick={() => onRemove(line.id)} data-testid={`button-remove-${line.id}`}><Trash2 size={13} /> Remove</button></div></div>; })}</div><aside className="summary"><h2>Order summary</h2><div className="summary-row"><span>Books</span><strong>{formatDzd(subtotal)}</strong></div><div className="summary-row"><span>Delivery</span><strong>{delivery === 0 ? 'Free' : formatDzd(delivery)}</strong></div><div className="summary-row total"><span>Total</span><strong>{formatDzd(subtotal + delivery)}</strong></div><button className="btn btn-primary" onClick={() => onNavigate('/checkout')} data-testid="button-checkout">Continue to checkout <ArrowRight size={15} /></button><p className="delivery-note"><Truck size={13} style={{ verticalAlign: 'middle' }} /> Free delivery in Algiers over 4,000 DA. COD available everywhere else.</p></aside></div> : <div className="cart-empty"><ShoppingBag className="empty-icon" size={35} /><h2 className="empty-title">Your bag is still dreaming.</h2><p className="empty-copy">Add a book or two and we&apos;ll get them ready for their trip to you.</p><button className="btn btn-primary" onClick={() => onNavigate('/shop')} data-testid="button-cart-shop">Find a book <ArrowRight size={15} /></button></div>}</div></main>;
}

function Checkout({ products, cart, onNavigate, onClearCart }: { products: Product[]; cart: CartLine[]; onNavigate: (path: string) => void; onClearCart: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const subtotal = cart.reduce((sum, line) => sum + (products.find((product) => product.id === line.id)?.price ?? 0) * line.quantity, 0);
  const delivery = subtotal >= 4000 ? 0 : 500;
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitted(true); onClearCart(); };
  if (submitted) return <main className="detail"><div className="container success-state"><div className="success-circle"><Check size={30} /></div><div className="eyebrow" style={{ marginTop: 22 }}>It&apos;s on its way</div><h1>Thank you for<br /><em style={{ color: 'hsl(338 48% 62%)' }}>trusting our shelves.</em></h1><p className="empty-copy">Your order is tucked away under the name on your order. We&apos;ll call you soon to confirm delivery — payment happens when your books arrive.</p><button className="btn btn-primary" onClick={() => onNavigate('/shop')} data-testid="button-success-shop">Keep browsing <ArrowRight size={15} /></button></div></main>;
  return <main><div className="container page-header"><div className="eyebrow">Almost yours</div><h1>Checkout, <em style={{ color: 'hsl(338 48% 62%)' }}>gently.</em></h1><p>No account, no card details. Just tell us where to send your books and pay when they arrive.</p></div><div className="container checkout-layout" style={{ paddingBottom: 90 }}><form className="form-card" onSubmit={submit}><h2>Delivery details</h2><div className="form-grid"><div className="field"><label htmlFor="checkout-name">Full name</label><input id="checkout-name" name="name" required placeholder="Your name" data-testid="input-checkout-name" /></div><div className="field"><label htmlFor="checkout-phone">Phone number</label><input id="checkout-phone" name="phone" required pattern=".{8,}" placeholder="05 / 06 / 07 …" data-testid="input-checkout-phone" /></div><div className="field"><label htmlFor="checkout-wilaya">Wilaya</label><select id="checkout-wilaya" required defaultValue="" data-testid="select-checkout-wilaya"><option value="" disabled>Select your wilaya</option><option>Alger</option><option>Oran</option><option>Blida</option><option>Constantine</option><option>Bejaia</option><option>Other wilaya</option></select></div><div className="field"><label htmlFor="checkout-city">City</label><input id="checkout-city" required placeholder="Your city" data-testid="input-checkout-city" /></div><div className="field full"><label htmlFor="checkout-address">Delivery address</label><input id="checkout-address" required placeholder="Street, building, helpful landmark…" data-testid="input-checkout-address" /></div><div className="field full"><label htmlFor="checkout-note">A note for the delivery person <span className="muted">(optional)</span></label><input id="checkout-note" placeholder="Call me before arriving…" data-testid="input-checkout-note" /></div></div><div style={{ marginTop: 25, paddingTop: 18, borderTop: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))', fontSize: 11 }}><Clock3 size={13} style={{ verticalAlign: 'middle' }} /> We&apos;ll confirm your order by phone before dispatching.</div><button className="btn btn-primary" style={{ marginTop: 20, width: '100%' }} type="submit" data-testid="button-place-order">Place my order · {formatDzd(subtotal + delivery)} <ArrowRight size={15} /></button></form><aside className="summary"><h2>Your books</h2>{cart.map((line) => { const product = products.find((item) => item.id === line.id); return product ? <div className="summary-row" key={line.id}><span>{product.title} × {line.quantity}</span><strong>{formatDzd(product.price * line.quantity)}</strong></div> : null; })}<div className="summary-row"><span>Delivery</span><strong>{delivery ? formatDzd(delivery) : 'Free'}</strong></div><div className="summary-row total"><span>Total</span><strong>{formatDzd(subtotal + delivery)}</strong></div><p className="delivery-note"><Check size={13} style={{ verticalAlign: 'middle' }} /> Cash on delivery · no payment needed today.</p></aside></div></main>;
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
  if (!products) return <div className="app-shell"><Header location={location} cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} wishlistCount={wishlist.length} onNavigate={navigate} /><main><div className="container page-header"><div className="eyebrow">The online shelves</div><h1>{catalogError ? 'The shelves are unreachable.' : 'Opening the shelves…'}</h1><p>{catalogError ? 'Something went wrong fetching our books. Please refresh the page in a moment.' : 'One second while we fetch the books for you.'}</p>{catalogError && <button className="btn btn-primary" onClick={() => window.location.reload()} data-testid="button-retry-catalog">Try again</button>}</div></main><Footer onNavigate={navigate} /></div>;
  const page = path === '/' ? <Home products={products} wishlist={wishlist} onToggleWish={toggleWish} onAdd={addToCart} onOpen={(id) => navigate(`/book/${id}`)} onNavigate={navigate} /> : path === '/shop' ? <Shop products={products} wishlist={wishlist} onToggleWish={toggleWish} onAdd={addToCart} onOpen={(id) => navigate(`/book/${id}`)} onNavigate={navigate} /> : path === '/wishlist' ? <Wishlist products={products} wishlist={wishlist} onToggleWish={toggleWish} onAdd={addToCart} onOpen={(id) => navigate(`/book/${id}`)} onNavigate={navigate} /> : path === '/cart' ? <Cart products={products} cart={cart} onQuantity={updateQuantity} onRemove={removeLine} onNavigate={navigate} /> : path === '/checkout' ? <Checkout products={products} cart={cart} onNavigate={navigate} onClearCart={() => { setCart([]); clearCartItems(cartTokenRef.current).catch(() => {}); }} /> : detailProduct ? <ProductDetail product={detailProduct} isLoved={wishlist.includes(detailProduct.id)} onToggleWish={toggleWish} onAdd={addToCart} onNavigate={navigate} /> : <Wishlist products={products} wishlist={[]} onToggleWish={toggleWish} onAdd={addToCart} onOpen={(id) => navigate(`/book/${id}`)} onNavigate={() => navigate('/')} />;
  return <div className="app-shell"><Header location={location} cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} wishlistCount={wishlist.length} onNavigate={navigate} />{page}<Footer onNavigate={navigate} />{toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}</div>;
}

export default function App() {
  return <AppContent />;
}