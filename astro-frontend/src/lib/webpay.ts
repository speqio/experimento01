// Cliente mínimo de la API REST de Webpay Plus vía fetch. Se usa en vez de
// `transbank-sdk` porque el SDK depende de axios/http y falla en Cloudflare Workers.
type Env = Record<string, string | undefined>;

// Credenciales oficiales de integración de Transbank (públicas).
const INTEGRATION_CODE = '597055555532';
const INTEGRATION_KEY = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

function config(env: Env) {
  const prod = env.WEBPAY_ENVIRONMENT === 'PRODUCCION';
  return {
    base: prod
      ? 'https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions'
      : 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions',
    headers: {
      'Content-Type': 'application/json',
      'Tbk-Api-Key-Id': env.WEBPAY_COMMERCE_CODE ?? INTEGRATION_CODE,
      'Tbk-Api-Key-Secret': env.WEBPAY_API_KEY ?? INTEGRATION_KEY,
    },
  };
}

async function call(res: Response) {
  const text = await res.text();
  if (!res.ok) throw new Error(`Webpay ${res.status}: ${text}`);
  return JSON.parse(text);
}

export async function webpayCreate(
  env: Env,
  p: { buyOrder: string; sessionId: string; amount: number; returnUrl: string },
): Promise<{ token: string; url: string }> {
  const { base, headers } = config(env);
  return call(
    await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        buy_order: p.buyOrder,
        session_id: p.sessionId,
        amount: p.amount,
        return_url: p.returnUrl,
      }),
    }),
  );
}

export async function webpayCommit(
  env: Env,
  token: string,
): Promise<{ response_code: number; buy_order: string; authorization_code?: string }> {
  const { base, headers } = config(env);
  return call(await fetch(`${base}/${token}`, { method: 'PUT', headers }));
}
