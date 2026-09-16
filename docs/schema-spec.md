# Especificación Maestra SDD — Contratos GraphQL y Tipos

Metodología Spec-Driven Design (SDD) aplicada al e-commerce headless de Spa, Masajes y Cuidado Personal.

## 1. Arquitectura

```
[ Cliente / Navegador ]
        │
        ├── (1) SSG/SSR ──────► [ Astro Frontend — Cloudflare Worker ]
        │                                │
        │                                ├── (2) GraphQL Queries/Mutations ──► [ WordPress + WooCommerce (staging → dominio propio) ]
        │                                │
        │                                └── (3) Webpay Plus (Transbank, ambiente INTEGRACION)
```

- **Frontend**: Astro (modo híbrido) + Tailwind CSS + Nanostores, desplegado como Cloudflare Worker.
- **Backend**: WordPress + WooCommerce + ACF PRO + WPGraphQL + WooGraphQL + plugin de Gift Cards (modo saldo/crédito).
- **Conexión desacoplada del dominio**: el frontend nunca hardcodea la URL de WordPress — vive en `PUBLIC_WPGRAPHQL_URL`. Migrar de dominio es cambiar esa variable + `Allowed Origins` en WPGraphQL CORS, sin tocar código.

## 2. Matriz de Renderizado (Hybrid Strategy)

| Ruta | Modo Astro | Razón |
|---|---|---|
| `/`, `/tienda/*`, `/servicios/*`, `/gift-cards` | `prerender = true` (SSG) | Velocidad, SEO, generado en build desde WooGraphQL. |
| `/carrito` | SSR | Requiere sesión activa del carrito (WooCommerce-Session). |
| `/checkout/*`, `/api/webpay-*` | SSR | Maneja secretos de Webpay, firmas y endpoints de retorno POST/GET. |

## 3. Contrato de Tipos TypeScript

### 3.1 Catálogo y Servicios de Spa (`src/types/catalog.d.ts`)

```ts
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
```

### 3.2 Gift Cards y Checkout (`src/types/giftcard.d.ts`, `src/types/checkout.d.ts`)

```ts
// giftcard.d.ts
export interface GiftCardInput {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  message: string;
  deliveryDate?: string;
  amount: number;
}

export interface GiftCardBalance {
  code: string;
  remainingBalance: number;
  originalAmount: number;
  expiresAt?: string;
}

// checkout.d.ts
export interface CartItemMetaData {
  key: string;
  value: string;
}

export interface WebpayInitResponse {
  token: string;
  url: string;
}

export interface CheckoutInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  paymentMethod: 'webpay';
  giftCardCode?: string;
}
```

## 4. Contrato de API GraphQL

### 4.1 Producto con nodos de Upselling nativo de WooCommerce

```graphql
query GetProductBySlug($slug: ID!) {
  product(id: $slug, idType: SLUG) {
    id
    databaseId
    name
    slug
    description
    shortDescription
    ... on SimpleProduct {
      price
      regularPrice
      stockStatus
      image { sourceUrl altText }
      upsellProducts {
        nodes {
          id
          name
          slug
          ... on SimpleProduct { price image { sourceUrl } }
        }
      }
      crossSellProducts {
        nodes {
          id
          name
          slug
          ... on SimpleProduct { price image { sourceUrl } }
        }
      }
    }
  }
}
```

### 4.2 addToCart con MetaData para Gift Cards

```graphql
mutation AddGiftCardToCart($productId: Int!, $extraData: String!) {
  addToCart(
    input: {
      productId: $productId
      quantity: 1
      extraData: $extraData
    }
  ) {
    cart {
      total
      subtotal
      appliedCoupons { code discountAmount }
      contents { itemCount }
    }
  }
}
```

### 4.3 Aplicar saldo de Gift Card al carrito (modo crédito)

```graphql
mutation ApplyGiftCardBalance($code: String!) {
  applyCoupon(input: { code: $code }) {
    cart {
      total
      subtotal
      appliedCoupons { code discountAmount }
      needsPayment
    }
  }
}
```

> El plugin de Gift Cards ya activo expone el saldo como cupón/crédito aplicable — por eso se reutiliza `applyCoupon` en vez de una mutación custom. Si el saldo no cubre el total, `needsPayment` sigue en `true` y el resto se cobra por Webpay en el mismo checkout.

## 5. Portabilidad de dominio

Checklist para migrar el frontend/backend a un dominio definitivo sin tocar código:

1. Actualizar `PUBLIC_WPGRAPHQL_URL` (secret del Worker / variable de CI).
2. Actualizar `Allowed Origins` en WPGraphQL → CORS Settings.
3. Actualizar la URL de retorno de Webpay (`return_url` en `webpay-init.ts` se deriva de `PUBLIC_SITE_URL`).
4. Enlazar el nuevo dominio como Custom Domain del Worker en Cloudflare.
5. Redeploy (`wrangler deploy` o push a `main` si ya está el CI/CD activo).
