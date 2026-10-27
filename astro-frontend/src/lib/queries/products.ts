// `image` vive en la interfaz Product (aplica a cualquier tipo), pero
// `price`/`regularPrice` y `stockStatus` no: el catálogo real tiene tanto
// SimpleProduct como VariableProduct (productos con variaciones), así que
// hay que pedirlos con fragmentos inline para ambos tipos o quedan null.
export const PRODUCT_CARD_FIELDS = /* GraphQL */ `
  __typename
  id
  databaseId
  name
  slug
  shortDescription
  giftCardEnabled
  image { sourceUrl(size: MEDIUM_LARGE) altText }
  ... on InventoriedProduct { stockStatus }
  ... on SimpleProduct { price regularPrice }
  ... on VariableProduct { price regularPrice }
  ... on ProductWithAttributes { attributes { nodes { name options } } }
  ... on WithAcfGiftCardFields { giftCardFields { giftCard codigoGiftcard } }
  ... on WithAcfUpsellerFields {
    upsellerFields {
      nombreProducto
      productosPrincipalesIds(first: 100) { nodes { ... on Product { id name slug } } }
    }
  }
  ... on Product { productCategories { nodes { name slug } } }
`;

export const GET_PRODUCT_BY_SLUG = /* GraphQL */ `
  query GetProductBySlug($slug: ID!) {
    product(id: $slug, idType: SLUG) {
      id
      databaseId
      name
      slug
      description
      shortDescription
      giftCardEnabled
      sku
      image { sourceUrl(size: LARGE) altText }
      productCategories { nodes { name slug parent { node { slug } } } }
      ... on InventoriedProduct { stockStatus }
      ... on SimpleProduct { price regularPrice }
      ... on VariableProduct {
        price
        regularPrice
        variations(first: 100) {
          nodes { databaseId price regularPrice attributes { nodes { name value } } }
        }
      }
      ... on ProductWithAttributes { attributes { nodes { name options } } }
      ... on WithAcfGiftCardFields { giftCardFields { giftCard codigoGiftcard } }
      ... on WithAcfUpsellerFields {
        upsellerFields {
          nombreProducto
          productosPrincipalesIds(first: 100) { nodes { ... on Product { id name slug } } }
        }
      }
      ... on SimpleProduct {
        upsell {
          nodes { ${PRODUCT_CARD_FIELDS} }
        }
        crossSell {
          nodes { ${PRODUCT_CARD_FIELDS} }
        }
      }
      ... on VariableProduct {
        upsell {
          nodes { ${PRODUCT_CARD_FIELDS} }
        }
        crossSell {
          nodes { ${PRODUCT_CARD_FIELDS} }
        }
      }
    }
  }
`;

export const GET_PRODUCT_CATEGORIES = /* GraphQL */ `
  query GetProductCategories {
    productCategories(first: 50, where: { hideEmpty: true }) {
      nodes {
        name
        slug
        count
      }
    }
  }
`;

// Liviana: solo foto + categorías, para ilustrar cada familia de servicios del Home.
export const GET_PRODUCT_IMAGES = /* GraphQL */ `
  query GetProductImages {
    products(first: 60, where: { status: "publish" }) {
      nodes {
        id
        image { sourceUrl(size: MEDIUM_LARGE) altText }
        productCategories { nodes { slug } }
      }
    }
  }
`;

export const GET_PRODUCTS = /* GraphQL */ `
  query GetProducts($first: Int = 24, $category: String, $search: String) {
    products(first: $first, where: { status: "publish", category: $category, search: $search }) {
      nodes { ${PRODUCT_CARD_FIELDS} }
    }
  }
`;

export const SEARCH_PRODUCTS = /* GraphQL */ `
  query SearchProducts($search: String!, $first: Int = 5) {
    products(first: $first, where: { status: "publish", search: $search }) {
      nodes {
        id
        name
        slug
        image { sourceUrl(size: THUMBNAIL) altText }
        ... on SimpleProduct { price }
        ... on VariableProduct { price }
      }
    }
  }
`;

// /etiqueta-producto/<slug>: misma URL que spamandala.cl, lista los productos de la etiqueta.
export const GET_PRODUCTS_BY_TAG = /* GraphQL */ `
  query GetProductsByTag($tag: String!, $tagId: ID!, $first: Int = 48) {
    products(first: $first, where: { status: "publish", tagIn: [$tag] }) {
      nodes { ${PRODUCT_CARD_FIELDS} }
    }
    productTag(id: $tagId, idType: SLUG) { name }
  }
`;

export const GET_PRODUCTS_BY_CATEGORIES = /* GraphQL */ `
  query GetProductsByCategories($categoryIn: [String], $first: Int = 3) {
    products(first: $first, where: { status: "publish", categoryIn: $categoryIn }) {
      nodes { ${PRODUCT_CARD_FIELDS} }
    }
  }
`;

// Ajustes globales de gift cards (wp-admin → Gift Cards → Ajustes), ver
// wordpress/mu-plugins/mandala-giftcards.php (campo RootQuery.giftCardSettings).
export const GET_GIFT_CARD_SETTINGS = /* GraphQL */ `
  query GetGiftCardSettings {
    giftCardSettings { enabled imageUrl }
  }
`;

// Productos elegidos a mano por slug (secciones de /promociones), sin depender del límite de 100.
export const GET_PRODUCTS_BY_SLUGS = /* GraphQL */ `
  query GetProductsBySlugs($slugs: [String], $first: Int = 50) {
    products(first: $first, where: { status: "publish", slugIn: $slugs }) {
      nodes { ${PRODUCT_CARD_FIELDS} }
    }
  }
`;

// Catálogo completo por páginas de 100 (máximo de WPGraphQL), para listar todas las ofertas.
export const GET_PRODUCTS_PAGE = /* GraphQL */ `
  query GetProductsPage($after: String) {
    products(first: 100, after: $after, where: { status: "publish" }) {
      pageInfo { hasNextPage endCursor }
      nodes { ${PRODUCT_CARD_FIELDS} }
    }
  }
`;
