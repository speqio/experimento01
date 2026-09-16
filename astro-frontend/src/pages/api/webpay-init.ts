import type { APIRoute } from 'astro';
import {
  WebpayPlus,
  Options,
  IntegrationApiKeys,
  Environment,
  IntegrationCommerceCodes,
} from 'transbank-sdk';
import type { CheckoutInput, WebpayInitResponse } from '../../types/checkout';

export const prerender = false;

function getWebpayTransaction(env: Record<string, string | undefined>) {
  const environment =
    env.WEBPAY_ENVIRONMENT === 'PRODUCCION' ? Environment.Production : Environment.Integration;

  const commerceCode = env.WEBPAY_COMMERCE_CODE ?? IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = env.WEBPAY_API_KEY ?? IntegrationApiKeys.WEBPAY;

  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));
}

export const POST: APIRoute = async ({ request, locals }) => {
  const input: CheckoutInput = await request.json();

  // `locals.runtime.env` expone los secrets del Worker (Cloudflare adapter).
  const env = (locals as any).runtime?.env ?? process.env;

  // TODO: crear la orden "pendiente" en WooCommerce vía REST/GraphQL con
  // `input` y el total real del carrito (ver docs/webpay-sequence.md §2),
  // aplicando el saldo de gift card ya reservado en el carrito si existe.
  const buyOrder = `order-${Date.now()}`;
  const sessionId = request.headers.get('woocommerce-session') ?? crypto.randomUUID();
  const amount = 1; // placeholder: reemplazar por el total real de la orden

  const tx = getWebpayTransaction(env);
  const returnUrl = `${env.PUBLIC_SITE_URL}/api/webpay-commit`;

  const response = await tx.create(buyOrder, sessionId, amount, returnUrl);

  const body: WebpayInitResponse = { token: response.token, url: response.url };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
