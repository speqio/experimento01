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

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const shouldProxy = PROXIED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );

  if (!shouldProxy) {
    return next();
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
