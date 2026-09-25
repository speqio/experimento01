import type { APIRoute } from 'astro';
import {
  WebpayPlus,
  Options,
  IntegrationApiKeys,
  Environment,
  IntegrationCommerceCodes,
} from 'transbank-sdk';
import type { CheckoutInput, WebpayInitResponse } from '../../types/checkout';
import { createOrderFromCart, updateOrderStatus } from '../../lib/woo-server';

export const prerender = false;

function getWebpayTransaction(env: Record<string, string | undefined>) {
  const environment =
    env.WEBPAY_ENVIRONMENT === 'PRODUCCION' ? Environment.Production : Environment.Integration;

  const commerceCode = env.WEBPAY_COMMERCE_CODE ?? IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = env.WEBPAY_API_KEY ?? IntegrationApiKeys.WEBPAY;

  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const input: CheckoutInput = await request.json();

  // `locals.runtime.env` expone los secrets del Worker (Cloudflare adapter).
  const env = { ...import.meta.env, ...process.env, ...((locals as any).runtime?.env ?? {}) } as Record<string, string | undefined>;

  const sessionHeader = request.headers.get('woocommerce-session') ?? '';
  if (!sessionHeader) return json({ error: 'Carrito vacío o sesión expirada' }, 400);

  let order;
  try {
    const { paymentMethod: _pm, giftCardCode: _gc, ...billing } = input;
    order = await createOrderFromCart(env, sessionHeader, billing);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  // Total $0 (ej. gift card canjeada al 100%): Transbank no acepta monto 0.
  if (order.total <= 0) {
    await updateOrderStatus(env, order.id, 'processing');
    return json({ free: true, redirect: `${env.PUBLIC_SITE_URL}/checkout/confirmacion?status=success&order=${order.id}` });
  }

  const buyOrder = `order-${order.id}`;
  const sessionId = crypto.randomUUID();
  const amount = order.total;

  const tx = getWebpayTransaction(env);
  const returnUrl = `${env.PUBLIC_SITE_URL}/api/webpay-commit`;

  const response = await tx.create(buyOrder, sessionId, amount, returnUrl);

  const body: WebpayInitResponse = { token: response.token, url: response.url };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
