import type { APIRoute } from 'astro';

// Verifica un código de gift card contra WooCommerce antes de dirigir al
// WhatsApp de reservas (ver components/giftcard/GiftCardRedeemModal.tsx).
// No marca nada como usado: eso sigue siendo manual o vía checkout.
export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { code, email } = (await request.json()) as { code?: string; email?: string };
    if (!code) return json({ valid: false, reason: 'Falta el código.' });

    const wpOrigin = new URL(import.meta.env.PUBLIC_WPGRAPHQL_URL).origin;
    const res = await fetch(`${wpOrigin}/wp-json/mandala/v1/gift-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, email }),
    });
    const data = await res.json();
    return json(data, res.ok ? 200 : 502);
  } catch (e) {
    return json({ valid: false, reason: (e as Error).message }, 500);
  }
};
