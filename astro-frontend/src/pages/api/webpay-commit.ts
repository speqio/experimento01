import type { APIRoute } from 'astro';
import { updateOrderStatus, getOrderState } from '../../lib/woo-server';
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
    const formData = request.method === 'POST' ? await request.formData() : null;
    const param = (name: string) => url.searchParams.get(name) || String(formData?.get(name) ?? '');
    const token = param('token_ws');
    // Sin token_ws: el usuario anuló la compra en Webpay (llega TBK_TOKEN + TBK_ORDEN_COMPRA).
    if (!token) {
      const cancelledId = Number(param('TBK_ORDEN_COMPRA').replace('order-', ''));
      if (cancelledId) {
        // Solo un pedido aún pendiente: este parámetro lo puede enviar cualquiera y no debe tocar pedidos pagados.
        const order = await getOrderState(env, cancelledId).catch(() => null);
        if (order?.status === 'pending') await updateOrderStatus(env, cancelledId, 'failed').catch(() => {});
      }
      return fail();
    }

    const result = await webpayCommit(env, token);
    const orderId = Number(String(result.buy_order).replace('order-', ''));

    if (result.response_code === 0) {
      // Defensa en profundidad: Transbank ya ata el monto al token desde
      // webpayCreate, pero se verifica igual contra el total real de la orden
      // antes de marcarla pagada (lo pide la propia guía de integración de
      // Transbank, por si el flujo cambia o esta función se reutiliza).
      const order = await getOrderState(env, orderId);
      if (Math.round(Number(result.amount)) !== order.total) {
        console.error(`webpay-commit: monto no coincide (orden #${orderId} total=${order.total} transbank=${result.amount})`);
        return fail('monto_no_coincide');
      }
      // Dispara el mu-plugin de gift cards (cupón + email) al pasar a processing.
      await updateOrderStatus(env, orderId, 'processing', result.authorization_code);
      return Response.redirect(`${site}/checkout/confirmacion?status=success&order=${orderId}&key=${encodeURIComponent(order.key)}`, 303);
    }

    await updateOrderStatus(env, orderId, 'failed').catch(() => {});
    return fail();
  } catch (e) {
    console.error('webpay-commit:', e);
    return fail();
  }
}

export const GET: APIRoute = ({ request, locals }) => commitAndRedirect(request, locals);
export const POST: APIRoute = ({ request, locals }) => commitAndRedirect(request, locals);
