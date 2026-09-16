import { persistentAtom } from '@nanostores/persistent';
import { atom } from 'nanostores';
import { wpQuery } from '../lib/wp-graphql';
import {
  ADD_TO_CART,
  ADD_GIFTCARD_TO_CART,
  UPDATE_ITEM_QUANTITIES,
  REMOVE_ITEMS_FROM_CART,
  APPLY_GIFTCARD_BALANCE,
} from '../lib/mutations/cart';
import type { SimpleProduct } from '../types/catalog';
import type { GiftCardInput } from '../types/giftcard';

export interface CartItem {
  key: string;
  quantity: number;
  product: Pick<SimpleProduct, 'id' | 'databaseId' | 'name' | 'slug' | 'price' | 'image'>;
}

export interface CartSummary {
  total: string;
  subtotal: string;
  itemCount: number;
  appliedCoupons: { code: string; discountAmount: string }[];
  needsPayment: boolean;
}

const emptySummary: CartSummary = {
  total: '0',
  subtotal: '0',
  itemCount: 0,
  appliedCoupons: [],
  needsPayment: false,
};

// Persistido en localStorage solo para UX (mostrar el badge del carrito sin
// esperar la red); la fuente de verdad del carrito sigue siendo WooCommerce
// vía woocommerce-session, manejado en wp-graphql.ts.
export const cartItemCount = persistentAtom<number>('cart-item-count', 0, {
  encode: String,
  decode: Number,
});

export const cartSummary = atom<CartSummary>(emptySummary);
export const isCartLoading = atom<boolean>(false);

function applySummary(cart: { total: string; subtotal: string; contents?: { itemCount: number }; appliedCoupons?: any[]; needsPayment?: boolean }) {
  const summary: CartSummary = {
    total: cart.total,
    subtotal: cart.subtotal,
    itemCount: cart.contents?.itemCount ?? cartItemCount.get(),
    appliedCoupons: cart.appliedCoupons ?? [],
    needsPayment: cart.needsPayment ?? true,
  };
  cartSummary.set(summary);
  cartItemCount.set(summary.itemCount);
  return summary;
}

export async function addToCart(productId: number, quantity = 1) {
  isCartLoading.set(true);
  try {
    const data = await wpQuery<{ addToCart: { cart: any } }>({
      query: ADD_TO_CART,
      variables: { productId, quantity },
    });
    return applySummary(data.addToCart.cart);
  } finally {
    isCartLoading.set(false);
  }
}

export async function addGiftCardToCart(productId: number, giftCard: GiftCardInput) {
  isCartLoading.set(true);
  try {
    const data = await wpQuery<{ addToCart: { cart: any } }>({
      query: ADD_GIFTCARD_TO_CART,
      variables: { productId, extraData: JSON.stringify(giftCard) },
    });
    return applySummary(data.addToCart.cart);
  } finally {
    isCartLoading.set(false);
  }
}

export async function updateItemQuantity(key: string, quantity: number) {
  isCartLoading.set(true);
  try {
    const data = await wpQuery<{ updateItemQuantities: { cart: any } }>({
      query: UPDATE_ITEM_QUANTITIES,
      variables: { key, quantity },
    });
    return applySummary(data.updateItemQuantities.cart);
  } finally {
    isCartLoading.set(false);
  }
}

export async function removeCartItem(key: string) {
  isCartLoading.set(true);
  try {
    const data = await wpQuery<{ removeItemsFromCart: { cart: any } }>({
      query: REMOVE_ITEMS_FROM_CART,
      variables: { keys: [key] },
    });
    return applySummary(data.removeItemsFromCart.cart);
  } finally {
    isCartLoading.set(false);
  }
}

// Aplica saldo de gift card como crédito; el remanente (si lo hay) se paga
// con Webpay en el mismo checkout — ver docs/schema-spec.md §4.3.
export async function applyGiftCardBalance(code: string) {
  isCartLoading.set(true);
  try {
    const data = await wpQuery<{ applyCoupon: { cart: any } }>({
      query: APPLY_GIFTCARD_BALANCE,
      variables: { code },
    });
    return applySummary(data.applyCoupon.cart);
  } finally {
    isCartLoading.set(false);
  }
}
