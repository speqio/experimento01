// Solo el dominio real se indexa; laboratorio.space y previews quedan fuera de Google.
export const isIndexable = (url: URL) => /(^|\.)spamandala\.cl$/.test(url.hostname);

export const STATIC_PATHS = [
  '/', '/tienda', '/promociones', '/gift-cards', '/blog', '/agenda',
  '/sobre-nosotras', '/politicas-de-la-empresa', '/politicas-de-privacidad',
];
