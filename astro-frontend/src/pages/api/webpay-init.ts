import type { APIRoute } from 'astro';
import type { CheckoutInput, WebpayInitResponse } from '../../types/checkout';
import { createOrderFromCart, updateOrderStatus } from '../../lib/woo-server';
import { webpayCreate } from '../../lib/webpay';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const input: CheckoutInput = await request.json();

    // `locals.runtime.env` expone los secrets del Worker (Cloudflare adapter).
    const env = { ...import.meta.env, ...process.env, ...((locals as any).runtime?.env ?? {}) } as Record<string, string | undefined>;

    const sessionHeader = request.headers.get('woocommerce-session') ?? '';
    if (!sessionHeader) return json({ error: 'Carrito vacío o sesión expirada' }, 400);

    const { paymentMethod: _pm, giftCardCode: _gc, ...billing } = input;
    const order = await createOrderFromCart(env, sessionHeader, billing);

    // Total $0 (ej. gift card canjeada al 100%): Transbank no acepta monto 0.
    if (order.total <= 0) {
      await updateOrderStatus(env, order.id, 'processing');
      return json({ free: true, redirect: `${env.PUBLIC_SITE_URL}/checkout/confirmacion?status=success&order=${order.id}` });
    }

    const response = await webpayCreate(env, {
      buyOrder: `order-${order.id}`,
      sessionId: crypto.randomUUID(),
      amount: order.total,
      returnUrl: `${env.PUBLIC_SITE_URL}/api/webpay-commit`,
    });

    const body: WebpayInitResponse = { token: response.token, url: response.url };
    return json(body);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
