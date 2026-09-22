import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { ShoppingBag, Search, Menu, X, Calendar, Phone, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { cartItemCount, cartSummary } from '../../store/cartStore';
import { SITE_INFO } from '../../lib/siteInfo';
import { wpQuery } from '../../lib/wp-graphql';
import { GET_PRODUCTS_BY_CATEGORIES } from '../../lib/queries/products';
import type { CategoryGroup } from '../../lib/categoryGroups';
import type { SimpleProduct } from '../../types/catalog';

const NAV_LINKS = [
  { label: 'Tienda', href: '/tienda' },
  { label: 'Gift Cards', href: '/gift-cards' },
];

interface HeaderProps {
  currentPath: string;
  categoryGroups: CategoryGroup[];
}

export default function Header({ currentPath, categoryGroups }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
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
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/98 backdrop-blur-md border-b border-[#ECE6DC]">
      <div className="bg-[#26211D] text-[#ECE5DC] text-[11px] py-1 px-4 text-center flex items-center justify-between sm:justify-center gap-4">
        <span className="hidden sm:flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#C8B8A6] shrink-0" />
          <span>Refugio de bienestar &middot; {SITE_INFO.address}</span>
        </span>
        <span className="sm:hidden">{SITE_INFO.name}</span>
        <a href={`tel:${SITE_INFO.phone}`} className="text-[#D8CABE] hover:text-white flex items-center gap-1 transition-colors">
          <Phone className="w-3 h-3" />
          <span className="hidden md:inline">{SITE_INFO.phone}</span>
        </a>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-24">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-2 text-spa-charcoal hover:bg-spa-sand rounded-full lg:hidden transition-colors"
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <form action="/tienda" className="hidden sm:flex items-center">
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="q"
                  placeholder="Buscar..."
                  className="w-44 md:w-56 lg:w-64 bg-transparent border border-[#DDD5CA] rounded-full py-1.5 pl-4 pr-10 text-xs text-spa-charcoal placeholder-[#8A7C6F] focus:outline-none focus:border-spa-taupe transition-colors"
                />
                <button
                  type="submit"
                  className="absolute right-1 w-6 h-6 rounded-full bg-[#EAE4D9] hover:bg-[#DDD5CA] flex items-center justify-center text-[#594A3D] transition-colors"
                  aria-label="Buscar"
                >
                  <Search className="w-3 h-3" />
                </button>
              </div>
            </form>
          </div>

          <a href="/" className="flex flex-col items-center group py-1 text-center select-none">
            <div className="w-8 h-8 sm:w-9 sm:h-9 mb-1 text-spa-charcoal group-hover:text-spa-taupe transition-colors">
              <svg viewBox="0 0 100 100" className="w-full h-full stroke-current fill-none" strokeWidth="2.5">
                <circle cx="50" cy="50" r="45" strokeOpacity="0.4" />
                <circle cx="50" cy="50" r="32" strokeOpacity="0.6" />
                <circle cx="50" cy="50" r="16" />
                <path d="M 50 18 C 42 32, 42 42, 50 50 C 58 42, 58 32, 50 18 Z" />
                <path d="M 50 82 C 42 68, 42 58, 50 50 C 58 58, 58 68, 50 82 Z" />
                <path d="M 18 50 C 32 42, 42 42, 50 50 C 42 58, 32 58, 18 50 Z" />
                <path d="M 82 50 C 68 42, 58 42, 50 50 C 58 58, 68 58, 82 50 Z" />
                <circle cx="50" cy="50" r="4" fill="currentColor" />
              </svg>
            </div>
            <span className="font-editorial text-2xl sm:text-3xl lg:text-4xl tracking-[0.25em] font-medium text-spa-charcoal uppercase">
              MÁNDALA
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-[0.3em] text-spa-taupe font-semibold uppercase mt-0.5">
              SPA &middot; MASAJES &middot; TERAPIAS
            </span>
          </a>

          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="/carrito"
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-spa-sand transition-colors group"
            >
              <span className="text-xs sm:text-sm font-serif font-medium text-spa-charcoal">
                ${Number(summary.total || 0).toLocaleString('es-CL')}
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
          onMouseLeave={() => setActiveGroup(null)}
        >
          <div className="flex items-center justify-between py-2">
            <nav className="flex items-center gap-7 text-xs tracking-wider font-medium text-[#4A3E34]">
              {categoryGroups.map((group) => (
                <button
                  key={group.label}
                  onMouseEnter={() => handleHoverGroup(group)}
                  className={`flex items-center gap-1 py-1 hover:text-spa-charcoal transition-colors ${
                    activeGroup === group.label ? 'text-spa-charcoal' : ''
                  }`}
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
                href="/tienda"
                onMouseEnter={() => setActiveGroup(null)}
                className={`py-1 hover:text-spa-charcoal transition-colors ${
                  currentPath === '/tienda' ? 'text-spa-charcoal font-bold underline underline-offset-8 decoration-spa-taupe' : ''
                }`}
              >
                Tienda
              </a>
              <a
                href="/nosotros"
                onMouseEnter={() => setActiveGroup(null)}
                className={`py-1 hover:text-spa-charcoal transition-colors ${
                  currentPath === '/nosotros' ? 'text-spa-charcoal font-bold underline underline-offset-8 decoration-spa-taupe' : ''
                }`}
              >
                Sobre Nosotras
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <a
                href="/promociones"
                className="bg-spa-charcoal hover:bg-[#4A403A] text-white px-5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-colors shadow-sm"
              >
                Promociones
              </a>
              <a
                href="/gift-cards"
                className="bg-transparent hover:bg-spa-sand text-spa-charcoal border border-[#DDD5CA] px-5 py-1.5 rounded-full text-xs font-medium tracking-wide flex items-center gap-1.5 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-spa-taupe" />
                <span>agenda</span>
              </a>
            </div>
          </div>

          {activeGroup && (() => {
            const group = categoryGroups.find((g) => g.label === activeGroup);
            if (!group) return null;
            const featured = featuredByGroup[group.label];
            const primarySlug = group.items[0]?.slug;
            const promoProduct = featured?.[0];

            return (
              <div className="absolute left-0 right-0 top-full mt-px bg-[#FDFBF7] border border-[#E8E2D7] border-t-0 shadow-2xl z-50 animate-in fade-in slide-in-from-top-3 duration-200">
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
                            className="text-sm text-[#54463A] hover:text-spa-charcoal transition-colors"
                          >
                            {category.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                    {primarySlug && (
                      <a
                        href={`/tienda?cat=${primarySlug}`}
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
                          <a key={product.id} href={`/tienda/${product.slug}`} className="group text-left normal-case">
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
                        href={`/tienda/${promoProduct.slug}`}
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

      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#FAF8F5] border-b border-[#ECE6DC] px-6 py-6 space-y-4 text-sm font-medium text-spa-charcoal animate-in fade-in slide-in-from-top-3 duration-200 max-h-[70vh] overflow-y-auto">
          <a href="/" className="block py-2.5 border-b border-spa-sand">
            Inicio
          </a>
          {categoryGroups.map((group) => (
            <div key={group.label} className="border-b border-spa-sand pb-2">
              <span className="text-xs uppercase tracking-wider text-spa-taupe block py-1.5">{group.label}</span>
              {group.items.map((category) => (
                <a
                  key={category.slug}
                  href={`/tienda?cat=${category.slug}`}
                  className="block pl-3 py-1.5 text-sm text-[#54463A]"
                >
                  {category.name}
                </a>
              ))}
            </div>
          ))}
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="block py-2.5 border-b border-spa-sand">
              {link.label}
            </a>
          ))}
          <a href="/nosotros" className="block py-2.5 border-b border-spa-sand">
            Sobre Nosotras
          </a>
          <a href="/carrito" className="block py-2.5">
            Carrito
          </a>
        </div>
      )}
    </header>
  );
}
