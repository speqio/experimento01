import type { APIRoute } from 'astro';
import { getShippingOptions } from '../../lib/woo-server';
import { validAddress } from '../../lib/comunas';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Métodos de envío para la dirección del checkout (solo carritos con productos físicos los tienen).
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { state, city, address1, method } = await request.json();
    const env = { ...import.meta.env, ...process.env, ...((locals as any).runtime?.env ?? {}) } as Record<string, string | undefined>;
    const session = request.headers.get('woocommerce-session') ?? '';
    if (!session) return json({ error: 'Carrito vacío o sesión expirada' }, 400);
    if (!validAddress(state, city)) return json({ error: 'Región o comuna inválida' }, 400);
    const options = await getShippingOptions(env, session, { state, city, address1: String(address1 ?? '') }, method || undefined);
    return json(options);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
