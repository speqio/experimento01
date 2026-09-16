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

  const res = await fetch(import.meta.env.PUBLIC_WPGRAPHQL_URL, {
    method: 'POST',
    credentials: 'include',
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
