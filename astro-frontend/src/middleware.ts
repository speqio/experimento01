import { defineMiddleware } from 'astro:middleware';

// Compatibilidad: cuando el dominio raíz pasa a servir el frontend Astro,
// WordPress se muda a un subdominio (ver docs/deployment-guide.md). Las
// URLs viejas ya guardadas en WooCommerce (ej. imágenes de producto en
// `/wp-content/uploads/...`) siguen usando el dominio raíz, así que estas
// rutas se reenvían tal cual al origen de WordPress en vez de dar 404.
// `WP_ORIGIN_HOST` nunca se hardcodea — mismo criterio de portabilidad que
// `PUBLIC_WPGRAPHQL_URL` (ver docs/schema-spec.md §5).
const PROXIED_PREFIXES = [
  '/wp-content/',
  '/wp-includes/',
  '/wp-json/',
  '/wp-admin/',
  '/wp-login.php',
  '/xmlrpc.php',
  '/graphql',
];

// Páginas SSR (home, tienda, fichas de producto, blog, gift-cards, etc.) no
// dependen de cookies/sesión — el carrito vive en localStorage del lado del
// cliente — así que se pueden cachear en el borde de Cloudflare por un rato
// corto sin mostrar contenido de otro usuario. Esto evita pagar el costo
// completo de las consultas a WordPress/GraphQL en cada visita, que es lo
// que más pesa en el LCP. Se excluyen checkout/carrito/api por las dudas
// (formularios y estado de pago, aunque hoy tampoco leen cookies).
//
// OJO: la Cache API de Cloudflare es local a cada datacenter (no global), así
// que solo ayuda a visitas repetidas cerca del mismo PoP — no espera moverse
// el resultado de un test de PageSpeed (corre desde datacenters de Google,
// normalmente sin caché previo). El caché que sí baja el tiempo de forma
// consistente para cualquier visita es el de datos en KV (ver kvCacheFrom en
// src/lib/wp-graphql.ts), que es global. Este caché HTML queda como un
// complemento adicional para tráfico real repetido.
const CACHE_TTL_SECONDS = 120;
const NOT_CACHEABLE_PREFIXES = ['/carrito', '/checkout', '/api'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const shouldProxy = PROXIED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );

  if (!shouldProxy) {
    const isCacheable =
      context.request.method === 'GET' &&
      typeof caches !== 'undefined' &&
      'default' in caches &&
      !NOT_CACHEABLE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

    if (!isCacheable) {
      return next();
    }

    // Toda esta capa es un "nice to have": si la Cache API falla por lo que
    // sea (headers que no le gustan, límites del runtime, etc.) NUNCA debe
    // tirar la respuesta real abajo. Antes un error acá (visto en Cloudflare
    // como 500 en algunos celulares) rompía la página entera aunque Astro ya
    // la hubiera generado bien.
    const cache = (caches as any).default;
    let cacheKey: Request | null = null;
    try {
      cacheKey = new Request(context.url.toString(), context.request);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch {
      cacheKey = null;
    }

    const response = await next();

    if (cacheKey && response.ok) {
      try {
        const toCache = response.clone();
        const headers = new Headers(toCache.headers);
        headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}`);
        const cacheable = new Response(toCache.body, { status: toCache.status, headers });
        const ctx = (context.locals as any).runtime?.ctx;
        const putPromise = cache.put(cacheKey, cacheable).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(putPromise);
        else await putPromise;
      } catch {
        // No se pudo cachear esta respuesta — no pasa nada, se sirve igual.
      }
    }
    return response;
  }

  const env = (context.locals as any).runtime?.env ?? process.env;
  const originHost = env.WP_ORIGIN_HOST;

  if (!originHost) {
    // Sin origen configurado (ej. dev local sin el secret seteado): deja
    // que Astro siga con su manejo normal en vez de fallar el proxy.
    return next();
  }

  const originUrl = `https://${originHost}${pathname}${search}`;
  const hasBody = !['GET', 'HEAD'].includes(context.request.method);

  return fetch(originUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: hasBody ? context.request.body : undefined,
    redirect: 'manual',
    // Cloudflare Workers requiere `duplex: 'half'` al reenviar un body
    // como stream (ej. POST /graphql) — no está en los tipos de RequestInit
    // de TS todavía.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);
});
