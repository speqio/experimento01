import type { APIRoute } from 'astro';
import {
  WebpayPlus,
  Options,
  IntegrationApiKeys,
  Environment,
  IntegrationCommerceCodes,
} from 'transbank-sdk';
import { updateOrderStatus } from '../../lib/woo-server';

export const prerender = false;

function getWebpayTransaction(env: Record<string, string | undefined>) {
  const environment =
    env.WEBPAY_ENVIRONMENT === 'PRODUCCION' ? Environment.Production : Environment.Integration;

  const commerceCode = env.WEBPAY_COMMERCE_CODE ?? IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = env.WEBPAY_API_KEY ?? IntegrationApiKeys.WEBPAY;

  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));
}

async function commitAndRedirect(request: Request, locals: any) {
  const env = { ...import.meta.env, ...process.env, ...(locals.runtime?.env ?? {}) } as Record<string, string | undefined>;
  const url = new URL(request.url);

  let token = url.searchParams.get('token_ws');
  if (!token && request.method === 'POST') {
    const formData = await request.formData();
    token = String(formData.get('token_ws') ?? '');
  }

  if (!token) {
    return Response.redirect(`${env.PUBLIC_SITE_URL}/checkout/confirmacion?status=error`, 303);
  }

  const tx = getWebpayTransaction(env);
  const result = await tx.commit(token);

  const orderId = Number(String(result.buy_order).replace('order-', ''));

  if (result.response_code === 0) {
    // Dispara el mu-plugin de gift cards (cupón + email) al pasar a processing.
    await updateOrderStatus(env, orderId, 'processing', result.authorization_code);
    return Response.redirect(
      `${env.PUBLIC_SITE_URL}/checkout/confirmacion?status=success&order=${orderId}`,
      303,
    );
  }

  await updateOrderStatus(env, orderId, 'failed').catch(() => {});

  return Response.redirect(`${env.PUBLIC_SITE_URL}/checkout/confirmacion?status=error`, 303);
}

export const GET: APIRoute = ({ request, locals }) => commitAndRedirect(request, locals);
export const POST: APIRoute = ({ request, locals }) => commitAndRedirect(request, locals);
