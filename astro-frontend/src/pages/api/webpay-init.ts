import type { APIRoute } from 'astro';
import type { CheckoutInput, WebpayInitResponse } from '../../types/checkout';
import { createOrderFromCart, updateOrderStatus, setOrderMeta, getShippingOptions } from '../../lib/woo-server';
import { validAddress } from '../../lib/comunas';
import { webpayCreate } from '../../lib/webpay';
import { isRateLimited } from '../../lib/rateLimit';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Cada intento crea un pedido en WooCommerce: se limita para que un bot no los llene de pedidos falsos.
    if (await isRateLimited(locals, request, 'webpay-init', 15)) {
      return json({ error: 'Demasiados intentos de pago. Espera unos minutos.' }, 429);
    }
    const input: CheckoutInput = await request.json();

    // `locals.runtime.env` expone los secrets del Worker (Cloudflare adapter).
    const env = { ...import.meta.env, ...process.env, ...((locals as any).runtime?.env ?? {}) } as Record<string, string | undefined>;

    const sessionHeader = request.headers.get('woocommerce-session') ?? '';
    if (!sessionHeader) return json({ error: 'Carrito vacío o sesión expirada' }, 400);

    const { paymentMethod: _pm, giftCardCode: _gc, attribution, shippingMethod, ...billing } = input;
    if (!validAddress(billing.state, billing.city)) return json({ error: 'Región o comuna inválida' }, 400);

    // El envío se recalcula aquí (no se confía en el navegador): si el carrito lleva productos
    // físicos, el método elegido debe ser uno de los que WooCommerce ofrece para esa región.
    const shipping = await getShippingOptions(env, sessionHeader, billing, shippingMethod);
    if (shipping.needsShipping && !shipping.rates.some((r) => r.id === shippingMethod)) {
      return json({ error: 'Elige un método de envío' }, 400);
    }
    const order = await createOrderFromCart(env, sessionHeader, billing, shipping.needsShipping ? shippingMethod : undefined);

    if (attribution) {
      // No bloquea el pago si falla — solo trazabilidad para wp-admin → Gift Cards.
      await setOrderMeta(env, order.id, { _mandala_attribution: JSON.stringify(attribution) }).catch(() => {});
    }

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
    console.error('webpay-init:', e);
    return json({ error: 'No pudimos iniciar el pago. Inténtalo de nuevo.' }, 500);
  }
};
