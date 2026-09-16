export const ADD_TO_CART = /* GraphQL */ `
  mutation AddToCart($productId: Int!, $quantity: Int = 1) {
    addToCart(input: { productId: $productId, quantity: $quantity }) {
      cart {
        total
        subtotal
        contents { itemCount }
      }
    }
  }
`;

export const ADD_GIFTCARD_TO_CART = /* GraphQL */ `
  mutation AddGiftCardToCart($productId: Int!, $extraData: String!) {
    addToCart(
      input: { productId: $productId, quantity: 1, extraData: $extraData }
    ) {
      cart {
        total
        subtotal
        contents { itemCount }
      }
    }
  }
`;

export const UPDATE_ITEM_QUANTITIES = /* GraphQL */ `
  mutation UpdateItemQuantities($key: ID!, $quantity: Int!) {
    updateItemQuantities(input: { items: [{ key: $key, quantity: $quantity }] }) {
      cart {
        total
        subtotal
        contents { itemCount nodes { key quantity } }
      }
    }
  }
`;

export const REMOVE_ITEMS_FROM_CART = /* GraphQL */ `
  mutation RemoveItemsFromCart($keys: [ID]!) {
    removeItemsFromCart(input: { keys: $keys }) {
      cart {
        total
        subtotal
        contents { itemCount }
      }
    }
  }
`;

// Aplica el saldo de gift card como crédito; si no cubre el total, el resto
// se paga con Webpay en el mismo checkout (needsPayment sigue en true).
export const APPLY_GIFTCARD_BALANCE = /* GraphQL */ `
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
`;
