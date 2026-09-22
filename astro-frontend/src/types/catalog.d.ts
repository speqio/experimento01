export interface ProductCategory {
  name: string;
  slug: string;
  count: number | null;
}

export interface ProductImage {
  sourceUrl: string;
  altText?: string;
}

export interface ProductAttribute {
  name: string;
  options: string[];
}

// Grupos ACF reales de producción (spamandala.cl), reproducidos por código
// en wordpress/mu-plugins/acf-field-groups.php — ver docs/wp-setup-guide.md §4.
export interface GiftCardFields {
  giftCard: 'SI' | null;
  codigoGiftcard: string | null;
}

export interface UpsellerFields {
  nombreProducto: string | null;
  productosPrincipalesIds?: { nodes: SimpleProduct[] } | null;
}

export interface SimpleProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  description?: string;
  shortDescription: string;
  price?: string;
  regularPrice?: string;
  stockStatus?: 'IN_STOCK' | 'OUT_OF_STOCK';
  image: ProductImage;
  galleryImages?: { nodes: ProductImage[] };
  attributes?: { nodes: ProductAttribute[] };
  productCategories?: { nodes: ProductCategory[] };
  upsell?: { nodes: SimpleProduct[] };
  crossSell?: { nodes: SimpleProduct[] };
  giftCardFields?: GiftCardFields;
  upsellerFields?: UpsellerFields;
}
