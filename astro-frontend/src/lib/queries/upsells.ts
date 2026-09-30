import { wpQuery } from '../wp-graphql';

interface KVLike {
  get(key: string, type: 'json'): Promise<any>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface UpsellCacheOptions {
  kv: KVLike;
  waitUntil?: (promise: Promise<unknown>) => void;
  ttlSeconds?: number;
}
const UPSELLS_KV_KEY = 'upsells:all';

// Complementos ("Complementa tu experiencia"): productos con el campo ACF
// `productos_principales_ids` (relación hacia los productos donde se ofrecen).
// GraphQL no permite filtrar por ese meta, así que se leen todos los productos
// una sola vez por build (cache de módulo) y se filtran aquí.
const GET_UPSELL_CANDIDATES = /* GraphQL */ `
  query GetUpsellCandidates($after: String) {
    products(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        databaseId
        name
        ... on SimpleProduct { price }
        ... on WithAcfUpsellerFields {
          upsellerFields {
            popupComplementoTexto
            productosPrincipalesIds { nodes { ... on Product { databaseId } } }
          }
        }
      }
    }
  }
`;

export interface Upsell {
  databaseId: number;
  name: string;
  price: string;
  popup: string;
  principales: number[];
}

let cache: Promise<Upsell[]> | null = null;

async function loadUpsells(): Promise<Upsell[]> {
  const found: Upsell[] = [];
  let after: string | null = null;
  for (;;) {
    const data: any = await wpQuery({ query: GET_UPSELL_CANDIDATES, variables: { after } });
    for (const p of data.products.nodes) {
      const ids: number[] = (p.upsellerFields?.productosPrincipalesIds?.nodes ?? [])
        .map((n: { databaseId?: number }) => n?.databaseId)
        .filter(Boolean);
      if (ids.length) {
        found.push({
          databaseId: p.databaseId,
          name: p.name,
          price: p.price ?? '',
          popup: p.upsellerFields?.popupComplementoTexto ?? '',
          principales: ids,
        });
      }
    }
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }
  return found;
}

export async function getUpsellsFor(principalId: number, kvCache?: UpsellCacheOptions): Promise<Upsell[]> {
  try {
    if (kvCache) {
      try {
        const cached = await kvCache.kv.get(UPSELLS_KV_KEY, 'json');
        if (cached) return (cached as Upsell[]).filter((u) => u.principales.includes(principalId));
      } catch {
        // KV no disponible — sigue con el escaneo normal.
      }
    }
    cache ??= loadUpsells();
    const all = await cache;
    if (kvCache) {
      const ttlSeconds = Math.max(kvCache.ttlSeconds ?? 90, 60);
      const putPromise = kvCache.kv
        .put(UPSELLS_KV_KEY, JSON.stringify(all), { expirationTtl: ttlSeconds })
        .catch(() => {});
      if (kvCache.waitUntil) kvCache.waitUntil(putPromise);
      else await putPromise;
    }
    return all.filter((u) => u.principales.includes(principalId));
  } catch {
    cache = null;
    return []; // WordPress no disponible o campo ACF aún no expuesto
  }
}
