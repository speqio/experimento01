export interface ProductImage {
  sourceUrl: string;
  altText?: string;
}

export interface SimpleProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: string;
  regularPrice: string;
  stockStatus: 'IN_STOCK' | 'OUT_OF_STOCK';
  image: ProductImage;
  galleryImages?: { nodes: ProductImage[] };
  upsellProducts?: { nodes: SimpleProduct[] };
  crossSellProducts?: { nodes: SimpleProduct[] };
}

export interface SpaServiceACF {
  durationMinutes: number;
  bodyZone: string;
  intensityLevel: 'Suave' | 'Medio' | 'Intenso';
  benefits: string[];
  contraindications?: string[];
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
