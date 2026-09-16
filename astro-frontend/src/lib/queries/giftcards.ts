export const GET_GIFTCARD_PRODUCTS = /* GraphQL */ `
  query GetGiftCardProducts {
    products(where: { category: "gift-cards" }) {
      nodes {
        id
        databaseId
        name
        slug
        ... on SimpleProduct { price image { sourceUrl } }
      }
    }
  }
`;

// El saldo se consulta como cupón/crédito del plugin (ver docs/schema-spec.md §4.3).
export const GET_GIFTCARD_BALANCE = /* GraphQL */ `
  query GetGiftCardBalance($code: String!) {
    coupon(id: $code, idType: CODE) {
      code
      amount
      dateExpiry
    }
  }
`;
