import { wpQuery } from './wp-graphql';
import { GET_PRODUCT_CATEGORIES, GET_GIFT_CARD_SETTINGS } from './queries/products';
import { groupCategories } from './categoryGroups';
import type { ProductCategory, GiftCardSettings } from '../types/catalog';

export interface LayoutData {
  categoryGroups: ReturnType<typeof groupCategories>;
  giftCardImageUrl: string;
}

/**
 * Datos que ECommerceLayout necesita en TODAS las páginas (categorías del
 * mega-menú, diseño de la gift card). Cada página la llama al principio de su
 * frontmatter (sin `await` todavía) y pasa la promesa como prop al layout, en
 * vez de dejar que el layout la dispare recién cuando Astro llega a
 * renderizarlo — así corre en paralelo con las consultas propias de la
 * página en lugar de sumarse en serie (cada round-trip a WordPress tarda
 * ~1.5s; hacerlas en serie duplicaba el TTFB).
 */
export async function fetchLayoutData(cache?: Parameters<typeof wpQuery>[0]['cache']): Promise<LayoutData> {
  const [categoriesResult, giftSettingsResult] = await Promise.allSettled([
    wpQuery<{ productCategories: { nodes: ProductCategory[] } }>({ query: GET_PRODUCT_CATEGORIES, cache }),
    wpQuery<{ giftCardSettings: GiftCardSettings }>({ query: GET_GIFT_CARD_SETTINGS, cache }),
  ]);

  // WordPress aún no disponible en build time — el header cae al menú simple.
  const categoryGroups =
    categoriesResult.status === 'fulfilled' ? groupCategories(categoriesResult.value.productCategories.nodes) : [];

  // Sin conexión en build time — GiftCardPreview cae a su imagen local de respaldo.
  const giftCardImageUrl =
    giftSettingsResult.status === 'fulfilled' ? giftSettingsResult.value.giftCardSettings?.imageUrl ?? '' : '';

  return { categoryGroups, giftCardImageUrl };
}
