const SESSION_STORAGE_KEY = 'woo-session';

interface WpQueryArgs {
  query: string;
  variables?: object;
}

/**
 * Cliente fetch genérico para WPGraphQL/WooGraphQL. Lee la URL desde
 * PUBLIC_WPGRAPHQL_URL (nunca hardcodeada) para que migrar de dominio sea
 * solo cambiar esa variable — ver docs/schema-spec.md §5.
 */
export async function wpQuery<T>({ query, variables = {} }: WpQueryArgs): Promise<T> {
  const sessionToken =
    typeof window !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;

  // Sin `credentials: 'include'` a propósito: la sesión de WooCommerce viaja
  // por el header `woocommerce-session` (JWT), no por cookies, y el CORS de
  // WPGraphQL responde con Access-Control-Allow-Origin: * — combinar eso con
  // `include` es justamente lo que el navegador bloquea.
  const res = await fetch(import.meta.env.PUBLIC_WPGRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { 'woocommerce-session': `Session ${sessionToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const newSession = res.headers.get('woocommerce-session');
  if (newSession && typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, newSession);
  }

  const { data, errors } = await res.json();
  if (errors) throw new Error(errors[0].message);

  return data as T;
}
