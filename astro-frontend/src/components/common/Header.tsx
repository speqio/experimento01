import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { ShoppingBag, Search, Menu, X, Calendar, Phone, Sparkles, ChevronDown, ChevronRight, ArrowLeft, MapPin, Clock } from 'lucide-react';
import { cartItemCount, cartSummary } from '../../store/cartStore';
import { SITE_INFO } from '../../lib/siteInfo';
import { wpQuery } from '../../lib/wp-graphql';
import { GET_PRODUCTS_BY_CATEGORIES, SEARCH_PRODUCTS } from '../../lib/queries/products';
import { categoryGroupHref, categoryGroupForLocation, type CategoryGroup } from '../../lib/categoryGroups';
import type { SimpleProduct } from '../../types/catalog';

const NAV_LINKS = [
  { label: 'Giftcards', href: '/gift-cards' },
];

interface HeaderProps {
  currentPath: string;
  currentCategory?: string | null;
  categoryGroups: CategoryGroup[];
}

// Subrayado que crece desde el centro al hacer hover; queda fijo cuando el link está activo
const navItemClass = (active: boolean) =>
  `relative py-1 transition-colors hover:text-spa-charcoal after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-px after:bg-spa-taupe after:origin-center after:scale-x-0 after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 ${
    active ? 'text-spa-charcoal after:scale-x-100' : ''
  }`;

const MIN_SEARCH_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 250;

type Suggestion = Pick<SimpleProduct, 'id' | 'name' | 'slug' | 'price' | 'image'>;

// panelAlign: hacia qué lado se abre el panel de sugerencias (a la derecha del header debe abrirse hacia la izquierda).
function SearchBox({ className = '', panelAlign = 'left' }: { className?: string; panelAlign?: 'left' | 'right' }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const term = query.trim();
  const searchable = term.length >= MIN_SEARCH_CHARS;

  useEffect(() => {
    if (!searchable) {
      requestId.current++;
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      wpQuery<{ products: { nodes: Suggestion[] } }>({
        query: SEARCH_PRODUCTS,
        variables: { search: term, first: 5 },
      })
        .then((data) => {
          if (id !== requestId.current) return;
          setSuggestions(data.products.nodes);
          setHighlight(-1);
          setLoading(false);
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setSuggestions([]);
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, searchable]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter' && open && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      window.location.href = `/producto/${suggestions[highlight].slug}`;
    }
  };

  const showPanel = open && searchable;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form action="/tienda" role="search" className="relative flex items-center">
        <input
          type="text"
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar…"
          autoComplete="off"
          aria-label="Buscar productos"
          className="w-full h-9 bg-[#F1EDE6] border border-transparent rounded-full pl-9 pr-4 text-xs text-spa-charcoal placeholder-[#7D6E61] hover:border-[#E2DBD0] focus:outline-none focus:bg-white focus:border-[#D6CCBF] transition-colors"
        />
        <button
          type="submit"
          className="absolute left-1 w-7 h-7 rounded-full flex items-center justify-center text-[#6E5C4E] hover:text-spa-charcoal transition-colors"
          aria-label="Buscar"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </form>

      {showPanel && (
        <div className={`absolute ${panelAlign === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-[20rem] max-w-[calc(100vw-2rem)] bg-[#FDFBF7] border border-[#E8E2D7] rounded-2xl shadow-2xl z-50 overflow-hidden`}>
          {loading && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-spa-taupe">Buscando…</div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-spa-taupe">Sin resultados para «{term}»</div>
          ) : (
            <ul>
              {suggestions.map((product, i) => (
                <li key={product.id}>
                  <a
                    href={`/producto/${product.slug}`}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                      highlight === i ? 'bg-spa-sand' : 'hover:bg-spa-sand'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-spa-cream shrink-0">
                      {product.image?.sourceUrl && (
                        <img src={product.image.sourceUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-spa-charcoal leading-snug line-clamp-2">
                        {product.name}
                      </span>
                      {product.price && (
                        <span
                          className="text-xs font-bold text-spa-taupe"
                          dangerouslySetInnerHTML={{ __html: product.price }}
                        />
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <a
            href={`/tienda?q=${encodeURIComponent(term)}`}
            className="flex items-center justify-between px-4 py-2.5 border-t border-[#ECE6DC] text-[11px] font-semibold uppercase tracking-wider text-spa-charcoal hover:text-spa-taupe transition-colors"
          >
            <span>Ver todos los resultados</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function Header({ currentPath, currentCategory, categoryGroups }: HeaderProps) {
  const currentGroup = categoryGroups.find((group) => group.items.some((category) => category.slug === currentCategory))?.label
    ?? categoryGroupForLocation(currentPath, currentCategory);
  const isGiftCardsActive = currentPath.replace(/\/+$/, '') === '/gift-cards';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const dialog = mobileDialogRef.current;
    if (!dialog) return;
    const scrollY = window.scrollY;
    const previous = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width, overflow: document.body.style.overflow };
    dialog.showModal();
    Object.assign(document.body.style, { position: 'fixed', top: `-${scrollY}px`, width: '100%', overflow: 'hidden' });
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
      dialog.close();
      Object.assign(document.body.style, previous);
      const behavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, scrollY);
      document.documentElement.style.scrollBehavior = behavior;
    };
  }, [mobileMenuOpen]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [mobileOpenGroup, setMobileOpenGroup] = useState<string | null>(null);
  const mobileBackRef = useRef<HTMLButtonElement>(null);
  const previousMobileGroup = useRef<string | null>(null);
  useEffect(() => {
    if (mobileMenuOpen) {
      if (mobileOpenGroup) mobileBackRef.current?.focus();
      else if (previousMobileGroup.current) {
        const index = categoryGroups.findIndex((group) => group.label === previousMobileGroup.current);
        document.getElementById(`mobile-category-trigger-${index}`)?.focus();
      }
    }
    previousMobileGroup.current = mobileOpenGroup;
  }, [mobileOpenGroup, mobileMenuOpen, categoryGroups]);
  const [featuredByGroup, setFeaturedByGroup] = useState<Record<string, SimpleProduct[]>>({});
  const count = useStore(cartItemCount);
  const summary = useStore(cartSummary);

  const handleHoverGroup = (group: CategoryGroup) => {
    setActiveGroup(group.label);
    if (featuredByGroup[group.label]) return;
    wpQuery<{ products: { nodes: SimpleProduct[] } }>({
      query: GET_PRODUCTS_BY_CATEGORIES,
      variables: { categoryIn: group.items.map((c) => c.slug), first: 3 },
    })
      .then((data) => {
        setFeaturedByGroup((prev) => ({ ...prev, [group.label]: data.products.nodes }));
      })
      .catch(() => {
        setFeaturedByGroup((prev) => ({ ...prev, [group.label]: [] }));
      });
  };

  return (
    <header className="relative z-40 bg-[#FAF8F5]/98 backdrop-blur-md border-b border-[#ECE6DC]">
      <div className="bg-[#26211D] text-[#ECE5DC] text-[11px] px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-4 lg:gap-x-5">
          <span className="hidden xl:flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#C8B8A6] shrink-0" aria-hidden="true" />
            Refugio de bienestar
          </span>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${SITE_INFO.streetAddress.split(',')[0]}, ${SITE_INFO.address}`)}`} target="_blank" rel="noopener noreferrer" className="basis-full lg:basis-auto min-h-11 flex items-center justify-center gap-1.5 py-1 text-center leading-relaxed hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8B8A6]">
            <MapPin className="w-3.5 h-3.5 text-[#C8B8A6] shrink-0" aria-hidden="true" />
            <span>{SITE_INFO.streetAddress}, {SITE_INFO.address}</span>
          </a>
          <div className="min-w-0 flex-1 lg:flex-none flex items-center justify-start lg:justify-center gap-1.5 py-1 leading-relaxed" aria-label="Horarios de atención">
            <Clock className="w-3.5 h-3.5 text-[#C8B8A6] shrink-0" aria-hidden="true" />
            <span>{SITE_INFO.schedule}</span>
          </div>
          <a href={`tel:${SITE_INFO.phone.replace(/\s/g, '')}`} aria-label={`Llamar al ${SITE_INFO.phone}`} className="min-h-11 shrink-0 text-[#ECE5DC] hover:text-white flex items-center gap-1.5 justify-center px-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8B8A6]">
            <Phone className="w-3.5 h-3.5 text-[#C8B8A6]" aria-hidden="true" />
            <span>{SITE_INFO.phone}</span>
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tres columnas con los lados del mismo ancho: así el logo queda centrado de verdad */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4 h-20 sm:h-24 lg:h-28">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setMobileOpenGroup(null); setMobileMenuOpen(true); }}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-haspopup="dialog"
              className="min-w-11 min-h-11 p-2 text-spa-charcoal hover:bg-spa-sand rounded-full lg:hidden transition-colors"
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* En escritorio el buscador va en la fila del menú; bajo 768 px no cabe junto al logo y va en el menú móvil */}
            <SearchBox className="hidden md:block lg:hidden w-44" />

            <a
              href="/agenda"
              className="hidden lg:inline-flex items-center gap-2 h-9 px-5 rounded-full border border-[#DDD5CA] text-xs font-medium tracking-wide text-spa-charcoal hover:bg-spa-sand transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-spa-taupe" />
              <span>agenda</span>
            </a>
          </div>

          <a href="/" className="flex items-center justify-center py-1 select-none" aria-label="Mándala Spa — inicio">
            <img
              src="/images/servicios/logo-mandala.webp"
              alt="Mándala Spa"
              width="320"
              height="128"
              style={{ maxWidth: '150px', height: 'auto' }}
              className="block"
            />
          </a>

          <div className="flex items-center justify-end gap-3 sm:gap-5">
            <a
              href="/promociones"
              className="hidden lg:inline-flex items-center h-9 px-5 rounded-full bg-spa-charcoal hover:bg-[#4A403A] text-white text-xs font-medium tracking-wide transition-colors"
            >
              Promociones
            </a>
            <a
              href="/carrito"
              aria-label={`Carrito, ${count} productos`}
              className="min-w-11 min-h-11 flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-spa-sand transition-colors group"
            >
              <span className="hidden sm:inline text-xs sm:text-sm font-serif font-medium text-spa-charcoal">
                {/* cart.total llega ya formateado desde WooGraphQL (ej. "$65.000"), no un número crudo */}
                {summary.total && summary.total !== '0' ? summary.total.replace(/&nbsp;/g, ' ') : '$0'}
              </span>
              <div className="relative">
                <ShoppingBag className="w-5 h-5 text-spa-charcoal group-hover:text-spa-taupe transition-colors" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-[#C94D3F] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </div>
            </a>
          </div>
        </div>

        <div
          className="hidden lg:block relative border-t border-[#ECE6DC]"
          onMouseLeave={(e) => { if (!e.currentTarget.contains(document.activeElement)) setActiveGroup(null); }}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveGroup(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && activeGroup) {
              e.preventDefault();
              document.getElementById(`category-trigger-${categoryGroups.findIndex((g) => g.label === activeGroup)}`)?.focus();
              setActiveGroup(null);
            }
          }}
        >
          {/* Entre 1024 y 1280 px el menú va más compacto para que quepa en una sola línea */}
          <div className="flex items-center justify-between gap-8 h-14">
            <nav className="flex items-center gap-5 xl:gap-9 whitespace-nowrap text-xs xl:text-[13px] tracking-[0.04em] font-medium text-[#4A3E34]">
              {categoryGroups.map((group) => (
                <button
                  key={group.label}
                  id={`category-trigger-${categoryGroups.indexOf(group)}`}
                  type="button"
                  aria-current={currentGroup === group.label ? 'page' : undefined}
                  aria-expanded={activeGroup === group.label}
                  aria-controls={activeGroup === group.label ? `category-panel-${categoryGroups.indexOf(group)}` : undefined}
                  onClick={() => handleHoverGroup(group)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleHoverGroup(group);
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      handleHoverGroup(group);
                      requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>(`#category-panel-${categoryGroups.indexOf(group)} a`)?.focus());
                    }
                  }}
                  onMouseEnter={() => handleHoverGroup(group)}
                  className={`flex items-center gap-1 ${navItemClass(currentGroup === group.label)}`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`w-3 h-3 text-spa-taupe transition-transform duration-200 ${
                      activeGroup === group.label ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              ))}
              <a
                href="/gift-cards"
                onMouseEnter={() => setActiveGroup(null)}
                aria-current={isGiftCardsActive ? 'page' : undefined}
                className={`${navItemClass(isGiftCardsActive)} ${isGiftCardsActive ? 'font-bold' : ''}`}
              >
                Giftcards
              </a>
              <a
                href="/sobre-nosotras"
                onMouseEnter={() => setActiveGroup(null)}
                className={`${navItemClass(currentPath === '/sobre-nosotras')} ${currentPath === '/sobre-nosotras' ? 'font-bold' : ''}`}
              >
                Sobre Nosotras
              </a>
              <a
                href="/blog"
                onMouseEnter={() => setActiveGroup(null)}
                className={`${navItemClass(currentPath.startsWith('/blog'))} ${currentPath.startsWith('/blog') ? 'font-bold' : ''}`}
              >
                Blog
              </a>
            </nav>

            <div onMouseEnter={() => setActiveGroup(null)}>
              <SearchBox className="w-44 xl:w-60" panelAlign="right" />
            </div>
          </div>

          {activeGroup && (() => {
            const group = categoryGroups.find((g) => g.label === activeGroup);
            if (!group) return null;
            const featured = featuredByGroup[group.label];
            const primarySlug = group.items[0]?.slug;
            const familyHref = categoryGroupHref(group.label);
            const promoProduct = featured?.[0];

            return (
              <div id={`category-panel-${categoryGroups.indexOf(group)}`} aria-labelledby={`category-trigger-${categoryGroups.indexOf(group)}`} className="absolute left-0 right-0 top-full mt-px bg-[#FDFBF7] border border-[#E8E2D7] border-t-0 shadow-2xl z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="grid grid-cols-12 gap-10 p-8">
                  <div className="col-span-3 border-r border-[#ECE6DC] pr-8">
                    <span className="text-[10px] font-semibold tracking-[0.2em] text-spa-taupe uppercase block mb-4">
                      Tratamientos {group.label}
                    </span>
                    <ul className="space-y-3 normal-case">
                      {group.items.map((category) => (
                        <li key={category.slug}>
                          <a
                            href={`/tienda?cat=${category.slug}`}
                            className="inline-block text-sm text-[#54463A] hover:text-spa-charcoal hover:translate-x-1 transition-all duration-200"
                          >
                            {category.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                    {primarySlug && (
                      <a
                        href={familyHref}
                        className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-spa-charcoal hover:text-spa-taupe transition-colors"
                      >
                        <span>Ver todo {group.label}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="col-span-6">
                    <span className="text-[10px] font-semibold tracking-[0.2em] text-spa-taupe uppercase block mb-4">
                      Destacados
                    </span>
                    {featured === undefined ? (
                      <div className="grid grid-cols-3 gap-5">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-28 rounded-xl bg-spa-sand animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-5">
                        {featured.map((product) => (
                          <a key={product.id} href={`/producto/${product.slug}`} className="group text-left normal-case">
                            <div className="h-28 rounded-xl overflow-hidden mb-2.5 bg-spa-cream">
                              {product.image?.sourceUrl && (
                                <img
                                  src={product.image.sourceUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-spa-charcoal leading-snug mb-1 line-clamp-2">
                              {product.name}
                            </h4>
                            {product.price && (
                              <span
                                className="text-xs font-bold text-spa-taupe"
                                dangerouslySetInnerHTML={{ __html: product.price }}
                              />
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-span-3">
                    {promoProduct ? (
                      <a
                        href={`/producto/${promoProduct.slug}`}
                        className="group relative block w-full h-full min-h-[220px] rounded-2xl overflow-hidden text-left"
                      >
                        {promoProduct.image?.sourceUrl && (
                          <img
                            src={promoProduct.image.sourceUrl}
                            alt={promoProduct.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-5 text-white normal-case">
                          <span className="text-[10px] tracking-[0.2em] uppercase text-[#D4C3B3] block mb-1">
                            Tratamiento Estrella
                          </span>
                          <span className="font-editorial text-xl font-medium block mb-3">{promoProduct.name}</span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full group-hover:bg-white/25 transition-colors">
                            Ver {group.label}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </a>
                    ) : (
                      <div className="w-full h-full min-h-[220px] rounded-2xl bg-spa-sand" />
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <dialog
        ref={mobileDialogRef}
        id="mobile-navigation"
        aria-labelledby="mobile-menu-title"
        className="mobile-navigation"
        onCancel={(event) => {
          if (mobileOpenGroup) { event.preventDefault(); setMobileOpenGroup(null); }
          else setMobileMenuOpen(false);
        }}
        onClose={() => setMobileMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget || (event.target as Element).closest('a[href]')) setMobileMenuOpen(false);
        }}
      >
        {mobileMenuOpen && (
          <div className="mobile-navigation-content text-spa-charcoal">
            <div className="mobile-navigation-heading">
              <h2 id="mobile-menu-title" className="font-editorial text-3xl">{mobileOpenGroup || 'Menú'}</h2>
              <button type="button" autoFocus onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú de navegación" className="flex min-h-12 min-w-12 items-center justify-center rounded-full hover:bg-spa-sand">
                <X className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
            <div className="mobile-navigation-stage">
              <div hidden={!!mobileOpenGroup} className="mobile-navigation-level">
                <SearchBox className="mobile-menu-search w-full" />
                <nav aria-label="Navegación principal móvil">
                  <a href="/" aria-current={currentPath === '/' ? 'page' : undefined}>Inicio</a>
                  {categoryGroups.map((group, index) => (
                    <button
                      key={group.label}
                      id={`mobile-category-trigger-${index}`}
                      type="button"
                      aria-expanded={mobileOpenGroup === group.label}
                      aria-controls="mobile-category-panel"
                      onClick={() => setMobileOpenGroup(group.label)}
                      className={currentGroup === group.label ? 'font-semibold' : ''}
                    >
                      <span>{group.label}</span>
                      <ChevronRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                  {[...NAV_LINKS, { label: 'Promociones', href: '/promociones' }, { label: 'Sobre Nosotras', href: '/sobre-nosotras' }, { label: 'Blog', href: '/blog' }, { label: 'Carrito', href: '/carrito' }].map((link) => (
                    <a key={link.href} href={link.href} aria-current={(link.href === '/gift-cards' ? isGiftCardsActive : currentPath === link.href || currentPath.startsWith(link.href + '/')) ? 'page' : undefined}>{link.label}</a>
                  ))}
                </nav>
              </div>
              <section id="mobile-category-panel" hidden={!mobileOpenGroup} className="mobile-navigation-level mobile-navigation-subpanel" aria-label={mobileOpenGroup || 'Categoría'}>
                <button ref={mobileBackRef} type="button" onClick={() => setMobileOpenGroup(null)} className="mobile-navigation-back">
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  Volver al menú
                </button>
                <nav key={mobileOpenGroup} aria-label={`Opciones de ${mobileOpenGroup}`}>
                  {categoryGroups.filter((group) => group.label === mobileOpenGroup).map((group) => (
                    <div key={group.label}>
                      <a href={categoryGroupHref(group.label)} className="font-semibold">Ver todo {group.label}</a>
                      {group.items.map((category) => (
                        <a key={category.slug} href={`/tienda?cat=${category.slug}`} aria-current={currentCategory === category.slug ? 'page' : undefined}>
                          <span>{category.name}</span>
                          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  ))}
                </nav>
              </section>
            </div>
            <div className="mobile-navigation-footer">
              <a href="/agenda" className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-medium transition-colors">
                <Calendar className="w-5 h-5" aria-hidden="true" />
                Agendar
              </a>
            </div>
          </div>
        )}
      </dialog>

    </header>
  );
}
