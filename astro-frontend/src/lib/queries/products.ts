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
`;

export const GET_PRODUCTS = /* GraphQL */ `
  query GetProducts($first: Int = 24) {
    products(first: $first, where: { status: "publish" }) {
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
