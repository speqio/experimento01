// Utilidades SOLO de servidor (endpoints SSR). Usan claves REST de WooCommerce
// que nunca deben llegar al navegador (ver docs/wp-setup-guide.md §7).
import { WORKER_USER_AGENT } from './wp-graphql';

type Env = Record<string, string | undefined>;

const CHECKOUT_MUTATION = /* GraphQL */ `
  mutation Checkout($input: CheckoutInput!) {
    checkout(input: $input) {
      result
      order { databaseId total(format: RAW) }
    }
  }
`;

export interface CreatedOrder {
  id: number;
  total: number;
}

function graphqlUrl(env: Env) {
  return env.PUBLIC_WPGRAPHQL_URL ?? import.meta.env.PUBLIC_WPGRAPHQL_URL;
}

/** Crea la orden pendiente desde el carrito de la sesión (cupones incluidos). */
export async function createOrderFromCart(
  env: Env,
  sessionHeader: string,
  billing: { firstName: string; lastName: string; email: string; phone: string; address1: string; city: string },
): Promise<CreatedOrder> {
  const res = await fetch(graphqlUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WORKER_USER_AGENT,
      'woocommerce-session': sessionHeader,
    },
    body: JSON.stringify({
      query: CHECKOUT_MUTATION,
      variables: {
        input: {
          paymentMethod: 'webpay',
          isPaid: false,
          billing: { ...billing, country: 'CL' },
        },
      },
    }),
  });
  const json = await res.json();
  const order = json?.data?.checkout?.order;
  if (!order) throw new Error(json?.errors?.[0]?.message ?? 'No se pudo crear la orden');
  return { id: order.databaseId, total: Math.round(Number(order.total)) };
}

/** Adjunta meta_data a una orden vía REST (ej. `_mandala_attribution`, ver lib/attribution.ts). */
export async function setOrderMeta(env: Env, orderId: number, meta: Record<string, unknown>) {
  const origin = new URL(graphqlUrl(env)).origin;
  const auth = btoa(`${env.WC_REST_KEY}:${env.WC_REST_SECRET}`);
  const res = await fetch(`${origin}/wp-json/wc/v3/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WORKER_USER_AGENT,
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      meta_data: Object.entries(meta).map(([key, value]) => ({ key, value })),
    }),
  });
  // No crítico: si falla, la orden y el regalo siguen funcionando sin trazabilidad de origen.
  if (!res.ok) console.error(`setOrderMeta ${orderId} REST ${res.status}: ${await res.text()}`);
}

/**
 * Monto real de la orden en WooCommerce — se usa para verificar contra lo que
 * confirma Transbank antes de marcar la orden como pagada (ver webpay-commit.ts).
 * Defensa en profundidad: el `buy_order`/monto ya quedan atados al token en
 * Transbank desde `webpayCreate`, pero la propia guía de integración de
 * Transbank pide validar igual el monto en el commit, por si el flujo cambia
 * o esta función se reutiliza en otro contexto.
 */
export async function getOrderTotal(env: Env, orderId: number): Promise<number> {
  const origin = new URL(graphqlUrl(env)).origin;
  const auth = btoa(`${env.WC_REST_KEY}:${env.WC_REST_SECRET}`);
  const res = await fetch(`${origin}/wp-json/wc/v3/orders/${orderId}`, {
    headers: { Authorization: `Basic ${auth}`, 'User-Agent': WORKER_USER_AGENT },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return Math.round(Number(data.total));
}

export interface OrderForAnalytics {
  transactionId: string;
  value: number;
  items: { item_id: string; item_name: string; price: number; quantity: number; item_variant: string; item_category: string; item_category2: string }[];
  purchaseType: 'product' | 'gift' | 'product_upsell' | 'gift_upsell';
}

/** Datos de una orden pagada para el evento `purchase` de GTM (ver pages/checkout/confirmacion.astro). */
export async function getOrderForAnalytics(env: Env, orderId: number): Promise<OrderForAnalytics> {
  const origin = new URL(graphqlUrl(env)).origin;
  const auth = btoa(`${env.WC_REST_KEY}:${env.WC_REST_SECRET}`);
  const res = await fetch(`${origin}/wp-json/wc/v3/orders/${orderId}`, {
    headers: { Authorization: `Basic ${auth}`, 'User-Agent': WORKER_USER_AGENT },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const lines: any[] = data.line_items ?? [];
  // `mandala` lo publica mandala-giftcards.php (la REST oculta las metas con "_").
  const mandala = data.mandala ?? { purchase_type: 'product', lines: {} };
  return {
    transactionId: String(data.id),
    value: Math.round(Number(data.total)),
    items: lines.map((l) => {
      const line = mandala.lines[String(l.product_id)] ?? {};
      return {
        item_id: String(l.product_id),
        item_name: l.name,
        price: Math.round(Number(l.total) / (l.quantity || 1)),
        quantity: l.quantity,
        // Ej. "spa-de-lujo_giftcard": producto + cómo se compró, visible como "Variante del artículo" en GA4.
        item_variant: `${line.slug || l.product_id}_${line.gift ? 'giftcard' : 'normal'}`,
        item_category: line.gift ? 'gift' : 'producto',
        item_category2: line.upsell ? 'upsell' : 'principal',
      };
    }),
    purchaseType: mandala.purchase_type,
  };
}

/** Cambia el estado de una orden vía REST (requiere WC_REST_KEY/WC_REST_SECRET). */
export async function updateOrderStatus(
  env: Env,
  orderId: number,
  status: 'processing' | 'completed' | 'failed' | 'cancelled',
  transactionId?: string,
) {
  const origin = new URL(graphqlUrl(env)).origin;
  const auth = btoa(`${env.WC_REST_KEY}:${env.WC_REST_SECRET}`);
  const res = await fetch(`${origin}/wp-json/wc/v3/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WORKER_USER_AGENT,
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      status,
      ...(status === 'processing' || status === 'completed'
        ? { set_paid: true, ...(transactionId ? { transaction_id: transactionId } : {}) }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
}
