// `image` vive en la interfaz Product (aplica a cualquier tipo), pero
// `price`/`regularPrice` y `stockStatus` no: el catálogo real tiene tanto
// SimpleProduct como VariableProduct (productos con variaciones), así que
// hay que pedirlos con fragmentos inline para ambos tipos o quedan null.
const PRODUCT_CARD_FIELDS = /* GraphQL */ `
  id
  databaseId
  name
  slug
  shortDescription
  image { sourceUrl altText }
  ... on InventoriedProduct { stockStatus }
  ... on SimpleProduct { price regularPrice }
  ... on VariableProduct { price regularPrice }
  ... on ProductWithAttributes { attributes { nodes { name options } } }
  ... on WithAcfGiftCardFields { giftCardFields { giftCard codigoGiftcard } }
  ... on WithAcfUpsellerFields {
    upsellerFields {
      nombreProducto
      productosPrincipalesIds { nodes { ... on Product { id name slug } } }
    }
  }
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
      image { sourceUrl altText }
      productCategories { nodes { name slug } }
      ... on InventoriedProduct { stockStatus }
      ... on SimpleProduct { price regularPrice }
      ... on VariableProduct { price regularPrice }
      ... on ProductWithAttributes { attributes { nodes { name options } } }
      ... on WithAcfGiftCardFields { giftCardFields { giftCard codigoGiftcard } }
      ... on WithAcfUpsellerFields {
        upsellerFields {
          nombreProducto
          productosPrincipalesIds { nodes { ... on Product { id name slug } } }
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
        image { sourceUrl altText }
        ... on SimpleProduct { price }
        ... on VariableProduct { price }
      }
    }
  }
`;

export const GET_PRODUCTS_BY_CATEGORIES = /* GraphQL */ `
  query GetProductsByCategories($categoryIn: [String], $first: Int = 3) {
    products(first: $first, where: { status: "publish", categoryIn: $categoryIn }) {
      nodes { ${PRODUCT_CARD_FIELDS} }
    }
  }
`;
