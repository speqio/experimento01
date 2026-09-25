import type { APIRoute } from 'astro';
import { updateOrderStatus } from '../../lib/woo-server';
import { webpayCommit } from '../../lib/webpay';

export const prerender = false;

async function commitAndRedirect(request: Request, locals: any) {
  const env = { ...import.meta.env, ...process.env, ...(locals.runtime?.env ?? {}) } as Record<string, string | undefined>;
  const site = env.PUBLIC_SITE_URL;
  const fail = (reason?: string) =>
    Response.redirect(
      `${site}/checkout/confirmacion?status=error${reason ? `&reason=${encodeURIComponent(reason.slice(0, 200))}` : ''}`,
      303,
    );

  try {
    const url = new URL(request.url);
    let token = url.searchParams.get('token_ws');
    if (!token && request.method === 'POST') {
      const formData = await request.formData();
      token = String(formData.get('token_ws') ?? '');
    }
    // Sin token_ws: el usuario anuló la compra en Webpay (llega TBK_TOKEN).
    if (!token) return fail();

    const result = await webpayCommit(env, token);
    const orderId = Number(String(result.buy_order).replace('order-', ''));

    if (result.response_code === 0) {
      // Dispara el mu-plugin de gift cards (cupón + email) al pasar a processing.
      await updateOrderStatus(env, orderId, 'processing', result.authorization_code);
      return Response.redirect(`${site}/checkout/confirmacion?status=success&order=${orderId}`, 303);
    }

    await updateOrderStatus(env, orderId, 'failed').catch(() => {});
    return fail();
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const GET: APIRoute = ({ request, locals }) => commitAndRedirect(request, locals);
export const POST: APIRoute = ({ request, locals }) => commitAndRedirect(request, locals);
