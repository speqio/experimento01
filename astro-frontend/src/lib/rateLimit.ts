// Límite simple de intentos por IP para los endpoints públicos (anti-abuso, no un límite crítico).
// Reusa el KV de caché de GraphQL (WP_CACHE) con otro prefijo de clave. Conteo no atómico
// (get+put): dos requests simultáneos pueden contar de más una vez, aceptable para esto.
export async function isRateLimited(locals: any, request: Request, name: string, max: number, windowSeconds = 600): Promise<boolean> {
  const kv = locals?.runtime?.env?.WP_CACHE;
  if (!kv) return false; // sin KV (ej. dev local): no bloquea
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const key = `ratelimit:${name}:${ip}`;
  const count = Number((await kv.get(key)) ?? '0');
  if (count >= max) return true;
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds }).catch(() => {});
  return false;
}
