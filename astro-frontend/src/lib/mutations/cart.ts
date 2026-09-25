const CART_FIELDS = /* GraphQL */ `
  total
  subtotal
  appliedCoupons { code discountAmount }
  contents {
    itemCount
    nodes {
      key
      quantity
      total
      product {
        node {
          ... on Product {
            id
            databaseId
            name
            slug
            image { sourceUrl altText }
          }
        }
      }
    }
  }
`;

export const GET_CART = /* GraphQL */ `
  query GetCart {
    cart { ${CART_FIELDS} }
  }
`;

export const ADD_TO_CART = /* GraphQL */ `
  mutation AddToCart($productId: Int!, $quantity: Int = 1, $variationId: Int) {
    addToCart(input: { productId: $productId, quantity: $quantity, variationId: $variationId }) {
      cart { ${CART_FIELDS} }
    }
  }
`;

export const ADD_GIFTCARD_TO_CART = /* GraphQL */ `
  mutation AddGiftCardToCart($productId: Int!, $extraData: String!, $variationId: Int) {
    addToCart(
      input: { productId: $productId, quantity: 1, extraData: $extraData, variationId: $variationId }
    ) {
      cart { ${CART_FIELDS} }
    }
  }
`;

export const UPDATE_ITEM_QUANTITIES = /* GraphQL */ `
  mutation UpdateItemQuantities($key: ID!, $quantity: Int!) {
    updateItemQuantities(input: { items: [{ key: $key, quantity: $quantity }] }) {
      cart { ${CART_FIELDS} }
    }
  }
`;

export const REMOVE_ITEMS_FROM_CART = /* GraphQL */ `
  mutation RemoveItemsFromCart($keys: [ID]!) {
    removeItemsFromCart(input: { keys: $keys }) {
      cart { ${CART_FIELDS} }
    }
  }
`;

// Aplica el saldo de gift card como crédito; si no cubre el total, el resto
// se paga con Webpay en el mismo checkout (needsPayment sigue en true).
export const APPLY_GIFTCARD_BALANCE = /* GraphQL */ `
  mutation ApplyGiftCardBalance($code: String!) {
    applyCoupon(input: { code: $code }) {
      cart { ${CART_FIELDS} }
    }
  }
`;
