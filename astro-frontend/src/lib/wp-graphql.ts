const SESSION_STORAGE_KEY = 'woo-session';

interface KVLike {
  get(key: string, type: 'json'): Promise<any>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface QueryCacheOptions {
  kv: KVLike;
  waitUntil?: (promise: Promise<unknown>) => void;
  ttlSeconds?: number;
  // URL de WPGraphQL leída del binding del Worker (wrangler.toml [vars]), no del
  // valor embebido en el build por Vite (import.meta.env) — si la variable de
  // repo de GitHub Actions que arma el build queda mal configurada, esta sigue
  // siendo la correcta en runtime. Ver kvCacheFrom().
  graphqlUrl?: string;
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

// ponytail: algunos WAF del hosting (ver waf_logs.csv, regla "Bad user-agent")
// bloquean requests con User-Agent vacío o genérico por parecer bots — el
// fetch del Worker no manda ninguno por defecto. Identificarnos evita el 403.
export const WORKER_USER_AGENT = 'MandalaAstroWorker/1.0 (+https://laboratorio.space)';

// ponytail: el hosting de cms.spamandala.cl responde 404 a POST/PUT en URLs reescritas
// (/wp-json/...); la forma sin reescritura funciona igual. Volver a `${origin}/wp-json${route}`
// cuando el hosting lo arregle.
export function wpRestUrl(origin: string, route: string): string {
  return `${origin}/index.php?rest_route=${route}`;
}

// KV acepta claves de hasta 512 bytes y las consultas de productos son más largas (fallaba en silencio
// y nunca se cacheaban): la clave es un hash SHA-256 de consulta + variables.
async function cacheKeyFor(query: string, variables: object): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${query}:${JSON.stringify(variables)}`));
  return 'wpq2:' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
  const cacheKey = cache && !sessionToken ? await cacheKeyFor(query, variables) : null;
  if (cacheKey) {
    try {
      // Servir y renovar en segundo plano: el dato se guarda hasta STALE_KV_TTL; si pasó su ttl,
      // esta visita igual lo recibe al tiro y WordPress se consulta por detrás (el hosting tarda 1–3 s).
      const cached = (await cache!.kv.get(cacheKey, 'json')) as { t?: number; d?: T } | null;
      if (cached?.d !== undefined) {
        const fresh = Date.now() - (cached.t ?? 0) < Math.max(cache!.ttlSeconds ?? 90, MIN_KV_TTL) * 1000;
        if (!fresh && cache!.waitUntil) cache!.waitUntil(fetchAndStore<T>(query, variables, cache!, cacheKey).catch(() => {}));
        if (fresh || cache!.waitUntil) return cached.d;
      }
    } catch {
      // KV no disponible (dev local sin binding, etc.) — sigue con el fetch normal.
    }
  }
  if (cacheKey && cache) return fetchAndStore<T>(query, variables, cache, cacheKey);
  return fetchGraphql<T>(query, variables, sessionToken, cache);
}

/** Cuánto vive un dato en KV aunque ya esté vencido, para servirlo mientras se renueva. */
const STALE_KV_TTL = 86400;

async function fetchAndStore<T>(query: string, variables: Record<string, unknown>, cache: QueryCacheOptions, cacheKey: string): Promise<T> {
  const data = await fetchGraphql<T>(query, variables, null, cache);
  const putPromise = cache.kv
    .put(cacheKey, JSON.stringify({ t: Date.now(), d: data }), { expirationTtl: STALE_KV_TTL })
    .catch(() => {});
  if (cache.waitUntil) cache.waitUntil(putPromise);
  else await putPromise;
  return data;
}

async function fetchGraphql<T>(query: string, variables: Record<string, unknown>, sessionToken: string | null, cache?: QueryCacheOptions): Promise<T> {
  // Sin `credentials: 'include'` a propósito: la sesión de WooCommerce viaja
  // por el header `woocommerce-session` (JWT), no por cookies, y el CORS de
  // WPGraphQL responde con Access-Control-Allow-Origin: * — combinar eso con
  // `include` es justamente lo que el navegador bloquea.
  const graphqlUrl = cache?.graphqlUrl || import.meta.env.PUBLIC_WPGRAPHQL_URL;
  const res = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WORKER_USER_AGENT,
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
    graphqlUrl: runtime?.env?.PUBLIC_WPGRAPHQL_URL,
  };
}
