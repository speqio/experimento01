import type { APIRoute } from 'astro';
import {
  WebpayPlus,
  Options,
  IntegrationApiKeys,
  Environment,
  IntegrationCommerceCodes,
} from 'transbank-sdk';

export const prerender = false;

function getWebpayTransaction(env: Record<string, string | undefined>) {
  const environment =
    env.WEBPAY_ENVIRONMENT === 'PRODUCCION' ? Environment.Production : Environment.Integration;

  const commerceCode = env.WEBPAY_COMMERCE_CODE ?? IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = env.WEBPAY_API_KEY ?? IntegrationApiKeys.WEBPAY;

  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));
}

async function commitAndRedirect(request: Request, locals: any) {
  const env = locals.runtime?.env ?? process.env;
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

  if (result.response_code === 0) {
    // TODO: actualizar la orden en WooCommerce a "Completada" vía REST/GraphQL
    // usando result.buy_order, y confirmar el consumo de saldo de gift card
    // si se aplicó (ver docs/webpay-sequence.md §2).
    return Response.redirect(
      `${env.PUBLIC_SITE_URL}/checkout/confirmacion?status=success&order=${result.buy_order}`,
      303,
    );
  }

  return Response.redirect(`${env.PUBLIC_SITE_URL}/checkout/confirmacion?status=error`, 303);
}

export const GET: APIRoute = ({ request, locals }) => commitAndRedirect(request, locals);
export const POST: APIRoute = ({ request, locals }) => commitAndRedirect(request, locals);
