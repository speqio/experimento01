export const GET_PRODUCT_BY_SLUG = /* GraphQL */ `
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
        upsell {
          nodes {
            id
            name
            slug
            ... on SimpleProduct { price image { sourceUrl } }
          }
        }
        crossSell {
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
  query GetProducts($first: Int = 24, $category: String) {
    products(first: $first, where: { status: "publish", category: $category }) {
      nodes {
        id
        databaseId
        name
        slug
        shortDescription
        ... on SimpleProduct {
          price
          regularPrice
          stockStatus
          image { sourceUrl altText }
        }
      }
    }
  }
`;
