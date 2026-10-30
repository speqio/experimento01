// Utilidades SOLO de servidor (endpoints SSR). Usan claves REST de WooCommerce
// que nunca deben llegar al navegador (ver docs/wp-setup-guide.md §7).
import { WORKER_USER_AGENT, wpRestUrl } from './wp-graphql';

type Env = Record<string, string | undefined>;

const CHECKOUT_MUTATION = /* GraphQL */ `
  mutation Checkout($input: CheckoutInput!) {
    checkout(input: $input) {
      result
      order { databaseId orderKey total(format: RAW) }
    }
  }
`;

export interface CreatedOrder {
  id: number;
  total: number;
  key: string; // order_key de WooCommerce: prueba de que quien ve la confirmación hizo el pedido
}

function graphqlUrl(env: Env) {
  return env.PUBLIC_WPGRAPHQL_URL ?? import.meta.env.PUBLIC_WPGRAPHQL_URL;
}

async function sessionGraphql(env: Env, sessionHeader: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(graphqlUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WORKER_USER_AGENT,
      'woocommerce-session': sessionHeader,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export interface ShippingAddress {
  state: string; // código de región de WooCommerce, ej. CL-RM
  city: string; // comuna
  address1: string;
}

export interface ShippingOptions {
  needsShipping: boolean;
  rates: { id: string; label: string; cost: number }[];
  chosen: string | null;
  total: number;
}

const SHIPPING_QUERY = /* GraphQL */ `
  mutation Shipping($address: CustomerAddressInput!, $methods: [String]) {
    updateCustomer(input: { shipping: $address, billing: $address }) { clientMutationId }
    updateShippingMethod(input: { shippingMethods: $methods }) { clientMutationId }
  }
`;
const SHIPPING_METHOD = /* GraphQL */ `
  mutation ShippingMethod($methods: [String]) {
    updateShippingMethod(input: { shippingMethods: $methods }) { clientMutationId }
  }
`;
const SHIPPING_CART =/* GraphQL */ `
  query ShippingCart {
    cart {
      needsShippingAddress
      total(format: RAW)
      chosenShippingMethods
      availableShippingMethods { rates { id label cost } }
    }
  }
`;

/**
 * Guarda la dirección en la sesión de WooCommerce y devuelve los métodos de envío de su zona
 * (WooCommerce → Ajustes → Envío). `method` elige uno; sin él WooCommerce deja el primero disponible.
 */
export async function getShippingOptions(env: Env, sessionHeader: string, address: ShippingAddress, method?: string): Promise<ShippingOptions> {
  // Carrito solo con servicios: el cliente puede no dar dirección, y entonces solo se lee el carrito.
  if (address.state) {
    const set = await sessionGraphql(env, sessionHeader, SHIPPING_QUERY, {
      address: { ...address, country: 'CL' },
      methods: method ? [method] : null,
    });
    if (set?.errors?.length && !set?.data?.updateCustomer) throw new Error(set.errors[0].message);
  }
  const readCart = async () => {
    const json = await sessionGraphql(env, sessionHeader, SHIPPING_CART);
    if (!json?.data?.cart) throw new Error(json?.errors?.[0]?.message ?? 'No se pudo leer el carrito');
    return json.data.cart;
  };
  let cart = await readCart();
  const toRates = (c: any): ShippingOptions['rates'] => (c.availableShippingMethods ?? []).flatMap((p: any) => p?.rates ?? []).map((r: any) => ({
    id: r.id,
    label: r.label,
    cost: Number(String(r.cost ?? '0').replace(/\D/g, '')) || 0, // CLP sin decimales; WooGraphQL lo entrega formateado
  }));
  let rates = toRates(cart);
  // Sin elección del cliente WooCommerce deja el primero (ej. PAKET): se prefiere el más barato, así el envío gratis queda marcado.
  if (!method && rates.length) {
    const cheapest = rates.reduce((a, b) => (b.cost < a.cost ? b : a));
    if (cheapest.id !== cart.chosenShippingMethods?.[0]) {
      await sessionGraphql(env, sessionHeader, SHIPPING_METHOD, { methods: [cheapest.id] });
      cart = await readCart();
      rates = toRates(cart);
    }
  }
  return {
    needsShipping: !!cart.needsShippingAddress,
    rates,
    chosen: cart.chosenShippingMethods?.[0] ?? null,
    total: Math.round(Number(cart.total)),
  };
}

/** Crea la orden pendiente desde el carrito de la sesión (cupones y envío elegido incluidos). */
export async function createOrderFromCart(
  env: Env,
  sessionHeader: string,
  billing: { firstName: string; lastName: string; email: string; phone: string; address1: string; city: string; state?: string },
  shippingMethod?: string,
  customerNote?: string,
): Promise<CreatedOrder> {
  const address = { ...billing, country: 'CL' };
  const json = await sessionGraphql(env, sessionHeader, CHECKOUT_MUTATION, {
    input: {
      paymentMethod: 'webpay',
      isPaid: false,
      billing: address,
      ...(customerNote ? { customerNote } : {}),
      ...(shippingMethod ? { shipping: address, shippingMethod: [shippingMethod] } : {}),
    },
  });
  const order = json?.data?.checkout?.order;
  if (!order) throw new Error(json?.errors?.[0]?.message ?? 'No se pudo crear la orden');
  return { id: order.databaseId, total: Math.round(Number(order.total)), key: order.orderKey };
}

/** Adjunta meta_data a una orden vía REST (ej. `_mandala_attribution`, ver lib/attribution.ts). */
export async function setOrderMeta(env: Env, orderId: number, meta: Record<string, unknown>) {
  const origin = new URL(graphqlUrl(env)).origin;
  const auth = btoa(`${env.WC_REST_KEY}:${env.WC_REST_SECRET}`);
  const res = await fetch(wpRestUrl(origin, `/wc/v3/orders/${orderId}`), {
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
export async function getOrderState(env: Env, orderId: number): Promise<{ total: number; status: string; key: string }> {
  const origin = new URL(graphqlUrl(env)).origin;
  const auth = btoa(`${env.WC_REST_KEY}:${env.WC_REST_SECRET}`);
  const res = await fetch(wpRestUrl(origin, `/wc/v3/orders/${orderId}`), {
    headers: { Authorization: `Basic ${auth}`, 'User-Agent': WORKER_USER_AGENT },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { total: Math.round(Number(data.total)), status: data.status, key: data.order_key };
}

export interface OrderForAnalytics {
  transactionId: string;
  value: number;
  items: { item_id: string; item_name: string; price: number; quantity: number; item_variant: string; item_category: string; item_category2: string }[];
  purchaseType: 'product' | 'gift' | 'product_upsell' | 'gift_upsell';
  status: string;
  key: string;
}

/** Datos de una orden pagada para el evento `purchase` de GTM (ver pages/checkout/confirmacion.astro). */
export async function getOrderForAnalytics(env: Env, orderId: number): Promise<OrderForAnalytics> {
  const origin = new URL(graphqlUrl(env)).origin;
  const auth = btoa(`${env.WC_REST_KEY}:${env.WC_REST_SECRET}`);
  const res = await fetch(wpRestUrl(origin, `/wc/v3/orders/${orderId}`), {
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
      const line = mandala.lines[String(l.id)] ?? {};
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
    status: data.status,
    key: data.order_key,
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
  const res = await fetch(wpRestUrl(origin, `/wc/v3/orders/${orderId}`), {
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
