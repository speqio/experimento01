import type { APIRoute } from 'astro';
import { WORKER_USER_AGENT, wpRestUrl } from '../../lib/wp-graphql';
import { isRateLimited } from '../../lib/rateLimit';

// Verifica un código de gift card contra WooCommerce antes de dirigir al
// WhatsApp de reservas (ver components/giftcard/GiftCardRedeemModal.tsx).
// No marca nada como usado: eso sigue siendo manual o vía checkout.
export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}


export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Evita automatizar pruebas de códigos al azar.
    if (await isRateLimited(locals, request, 'gift-verify', 10)) {
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
    console.error('gift-verify:', e);
    return json({ valid: false, reason: 'No pudimos verificar el código. Inténtalo de nuevo.' }, 500);
  }
};
