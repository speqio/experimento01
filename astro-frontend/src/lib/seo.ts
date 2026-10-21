import { SITE_INFO } from './siteInfo';
import seoWp from '../data/seo-wp.json';
import entradasWp from '../data/entradas-wp.json';

/** Ruta pública de una entrada: las de spamandala.cl siguen en /slug/ (su permalink original). */
export const postPath = (slug: string) => (entradasWp.includes(slug) ? `/${slug}/` : `/blog/${slug}/`);

// Solo el dominio real se indexa; laboratorio.space y previews quedan fuera de Google.
export const isIndexable = (url: URL) => /(^|\.)spamandala\.cl$/.test(url.hostname);

export const STATIC_PATHS = [
  '/', '/tienda', '/promociones', '/gift-cards', '/blog', '/agenda',
  '/sobre-nosotras', '/politicas-de-la-empresa', '/politicas-de-privacidad',
];

// Pantallas que no deben indexarse aunque estén en el dominio real.
const NOINDEX_PREFIXES = ['/carrito', '/checkout', '/api/'];

export interface Crumb { name: string; path: string }

/** SEO de Yoast en producción para esta ruta (src/data/seo-wp.json, de migracion/_herramientas/yoast_seo.py). */
type WpSeo = { canonical?: string; noindex?: boolean; image?: string; crumb?: string };
export function wpSeo(path: string): WpSeo {
  const key = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '').toLowerCase()}/`;
  return (seoWp as Record<string, WpSeo>)[key] ?? {};
}

/** Canonical con barra final, igual que los permalinks de spamandala.cl. */
export function canonicalFor(url: URL) {
  const post = url.pathname.match(/^\/blog\/([^/]+)\/?$/);
  const override = (post && postPath(post[1])) || wpSeo(url.pathname).canonical;
  const path = override ?? (url.pathname === '/' ? '/' : `/${url.pathname.replace(/^\/+|\/+$/g, '')}/`);
  return new URL(path, url.origin).toString();
}

export function isNoindex(url: URL, forced = false) {
  return forced || !isIndexable(url) || url.searchParams.has('q') || NOINDEX_PREFIXES.some((p) => url.pathname.startsWith(p)) || !!wpSeo(url.pathname).noindex;
}

/**
 * Imagen para redes: la que pase la página, si no la de Yoast (solo en el dominio real, porque apunta a
 * /wp-content/uploads que el middleware sirve desde WordPress), si no el logo.
 */
export function ogImageFor(url: URL, image?: string | null) {
  if (image) return image;
  const wp = wpSeo(url.pathname).image;
  if (wp && isIndexable(url)) return new URL(new URL(wp).pathname, url.origin).toString();
  return new URL(SITE_INFO.logo, url.origin).toString();
}

/** Negocio local (DaySpa) para Google: dirección, teléfono, horario y redes. */
export function businessSchema(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DaySpa',
    '@id': `${origin}/#negocio`,
    name: SITE_INFO.legalName,
    alternateName: SITE_INFO.name,
    url: `${origin}/`,
    logo: new URL(SITE_INFO.logo, origin).toString(),
    image: new URL(SITE_INFO.logo, origin).toString(),
    telephone: SITE_INFO.phone,
    email: SITE_INFO.email,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE_INFO.streetAddress,
      addressLocality: 'Las Condes',
      addressRegion: 'Región Metropolitana',
      addressCountry: 'CL',
    },
    openingHoursSpecification: SITE_INFO.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    sameAs: [SITE_INFO.instagram, SITE_INFO.youtube],
  };
}

export function breadcrumbSchema(origin: string, crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.path, origin).toString(),
    })),
  };
}
