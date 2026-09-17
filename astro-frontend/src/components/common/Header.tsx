import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { ShoppingBag, Search, Menu, X, Calendar, Phone, Sparkles } from 'lucide-react';
import { cartItemCount, cartSummary } from '../../store/cartStore';
import { SITE_INFO } from '../../lib/siteInfo';

const NAV_LINKS = [
  { label: 'Servicios', href: '/servicios' },
  { label: 'Tienda', href: '/tienda' },
  { label: 'Gift Cards', href: '/gift-cards' },
];

export default function Header({ currentPath }: { currentPath: string }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const count = useStore(cartItemCount);
  const summary = useStore(cartSummary);

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/98 backdrop-blur-md border-b border-[#ECE6DC]">
      <div className="bg-[#26211D] text-[#ECE5DC] text-[11px] py-1 px-4 text-center flex items-center justify-between sm:justify-center gap-4">
        <span className="hidden sm:inline flex items-center gap-1.5">
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

            <form action="/servicios" className="hidden sm:flex items-center">
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

        <div className="hidden lg:flex items-center justify-between py-2 border-t border-[#ECE6DC]">
          <nav className="flex items-center gap-7 text-xs tracking-wider uppercase font-medium text-[#4A3E34]">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`py-1 hover:text-spa-charcoal transition-colors ${
                  currentPath.startsWith(link.href) ? 'text-spa-charcoal font-bold underline underline-offset-8 decoration-spa-taupe' : ''
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href="/servicios"
            className="bg-spa-charcoal hover:bg-[#4A403A] text-white px-5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-[#D4C3B3]" />
            Reservar hora
          </a>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#FAF8F5] border-b border-[#ECE6DC] px-6 py-6 space-y-1 text-sm font-medium text-spa-charcoal animate-in fade-in slide-in-from-top-3 duration-200">
          <a href="/" className="block py-2.5 border-b border-spa-sand">
            Inicio
          </a>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="block py-2.5 border-b border-spa-sand">
              {link.label}
            </a>
          ))}
          <a href="/carrito" className="block py-2.5">
            Carrito
          </a>
        </div>
      )}
    </header>
  );
}
