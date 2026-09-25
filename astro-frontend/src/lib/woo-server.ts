// Utilidades SOLO de servidor (endpoints SSR). Usan claves REST de WooCommerce
// que nunca deben llegar al navegador (ver docs/wp-setup-guide.md §7).
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
    headers: { 'Content-Type': 'application/json', 'woocommerce-session': sessionHeader },
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
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      status,
      ...(status === 'processing' || status === 'completed'
        ? { set_paid: true, ...(transactionId ? { transaction_id: transactionId } : {}) }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
}
