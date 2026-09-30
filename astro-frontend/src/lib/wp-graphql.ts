const SESSION_STORAGE_KEY = 'woo-session';

interface KVLike {
  get(key: string, type: 'json'): Promise<any>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface QueryCacheOptions {
  kv: KVLike;
  waitUntil?: (promise: Promise<unknown>) => void;
  ttlSeconds?: number;
}

interface WpQueryArgs {
  query: string;
  variables?: object;
  /**
   * Solo para consultas de SOLO LECTURA hechas en SSR (páginas/layouts, nunca
   * desde el navegador): cachea la respuesta en Cloudflare KV (global, a
   * diferencia de la Cache API que es local a cada datacenter) para no pagar
   * el round-trip completo a WordPress en cada visita. Se arma con
   * `kvCacheFrom(Astro)`. Si no se pasa, el comportamiento es igual que antes
   * (siempre pega a WordPress).
   */
  cache?: QueryCacheOptions;
}

/** KV exige expirationTtl >= 60s. */
const MIN_KV_TTL = 60;

function cacheKeyFor(query: string, variables: object): string {
  return `wpq:${query}:${JSON.stringify(variables)}`;
}

/**
 * Cliente fetch genérico para WPGraphQL/WooGraphQL. Lee la URL desde
 * PUBLIC_WPGRAPHQL_URL (nunca hardcodeada) para que migrar de dominio sea
 * solo cambiar esa variable — ver docs/schema-spec.md §5.
 */
export async function wpQuery<T>({ query, variables = {}, cache }: WpQueryArgs): Promise<T> {
  const sessionToken =
    typeof window !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;

  // Nunca cachear si hay sesión de WooCommerce de por medio (carrito, checkout):
  // esas respuestas son por-usuario, no se pueden compartir entre visitantes.
  const cacheKey = cache && !sessionToken ? cacheKeyFor(query, variables) : null;
  if (cacheKey) {
    try {
      const cached = await cache!.kv.get(cacheKey, 'json');
      if (cached !== null && cached !== undefined) return cached as T;
    } catch {
      // KV no disponible (dev local sin binding, etc.) — sigue con el fetch normal.
    }
  }

  // Sin `credentials: 'include'` a propósito: la sesión de WooCommerce viaja
  // por el header `woocommerce-session` (JWT), no por cookies, y el CORS de
  // WPGraphQL responde con Access-Control-Allow-Origin: * — combinar eso con
  // `include` es justamente lo que el navegador bloquea.
  const res = await fetch(import.meta.env.PUBLIC_WPGRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { 'woocommerce-session': `Session ${sessionToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const newSession = res.headers.get('woocommerce-session');
  if (newSession && typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, newSession);
  }

  const { data, errors } = await res.json();
  if (errors) throw new Error(errors[0].message);

  if (cacheKey && cache) {
    const ttlSeconds = Math.max(cache.ttlSeconds ?? 90, MIN_KV_TTL);
    const putPromise = cache.kv
      .put(cacheKey, JSON.stringify(data), { expirationTtl: ttlSeconds })
      .catch(() => {});
    if (cache.waitUntil) cache.waitUntil(putPromise);
    else await putPromise;
  }

  return data as T;
}

/**
 * Arma las opciones de caché KV a partir de `Astro.locals.runtime` (adapter
 * @astrojs/cloudflare). Devuelve `undefined` si no hay binding `WP_CACHE`
 * (dev local sin KV, por ejemplo) — en ese caso wpQuery simplemente no cachea.
 */
export function kvCacheFrom(Astro: { locals: any }, ttlSeconds = 90): QueryCacheOptions | undefined {
  const runtime = Astro?.locals?.runtime;
  const kv = runtime?.env?.WP_CACHE;
  if (!kv) return undefined;
  const ctx = runtime?.ctx;
  return {
    kv,
    waitUntil: ctx?.waitUntil ? ctx.waitUntil.bind(ctx) : undefined,
    ttlSeconds,
  };
}
