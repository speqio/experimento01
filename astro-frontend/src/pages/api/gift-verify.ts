import type { APIRoute } from 'astro';
import { WORKER_USER_AGENT, wpRestUrl } from '../../lib/wp-graphql';

// Verifica un código de gift card contra WooCommerce antes de dirigir al
// WhatsApp de reservas (ver components/giftcard/GiftCardRedeemModal.tsx).
// No marca nada como usado: eso sigue siendo manual o vía checkout.
export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Rate limit simple por IP: evita automatizar pruebas de códigos al azar.
// Reusa el mismo KV de caché de GraphQL (WP_CACHE) con otro prefijo de clave
// — no hace falta un namespace nuevo para un contador tan chico. Conteo no
// atómico (get+put): en el peor caso dos requests simultáneos cuentan de más
// una vez, aceptable para esto (no es un límite de seguridad crítico, solo
// anti-abuso).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutos

async function isRateLimited(locals: any, ip: string): Promise<boolean> {
  const kv = (locals as any)?.runtime?.env?.WP_CACHE;
  if (!kv) return false; // sin KV (ej. dev local): no bloquea
  const key = `ratelimit:gift-verify:${ip}`;
  const count = Number((await kv.get(key)) ?? '0');
  if (count >= RATE_LIMIT_MAX) return true;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS }).catch(() => {});
  return false;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (await isRateLimited(locals, ip)) {
      return json({ valid: false, reason: 'Demasiados intentos. Prueba de nuevo en unos minutos.' }, 429);
    }

    const { code, email } = (await request.json()) as { code?: string; email?: string };
    if (!code) return json({ valid: false, reason: 'Falta el código.' });

    const wpOrigin = new URL(import.meta.env.PUBLIC_WPGRAPHQL_URL).origin;
    const res = await fetch(wpRestUrl(wpOrigin, '/mandala/v1/gift-verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': WORKER_USER_AGENT },
      body: JSON.stringify({ code, email }),
    });
    const data = await res.json();
    return json(data, res.ok ? 200 : 502);
  } catch (e) {
    return json({ valid: false, reason: (e as Error).message }, 500);
  }
};
