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
  upsell?: { nodes: SimpleProduct[] };
  crossSell?: { nodes: SimpleProduct[] };
}

// benefits/contraindications vienen de ACF (versión gratuita, sin Repeater)
// como textarea de un ítem por línea — ver src/lib/parse.ts y
// docs/wp-setup-guide.md §4.
export interface SpaServiceACF {
  durationMinutes: number;
  bodyZone: string;
  intensityLevel: 'Suave' | 'Medio' | 'Intenso';
  benefits: string;
  contraindications?: string;
  allowGiftCard: boolean;
}

export interface SpaService {
  id: string;
  title: string;
  slug: string;
  content: string;
  featuredImage: ProductImage;
  spaFields: SpaServiceACF;
  linkedProduct?: SimpleProduct;
}
