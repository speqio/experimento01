export interface CartItemMetaData {
  key: string;
  value: string;
}

export interface WebpayInitResponse {
  token?: string;
  url?: string;
  free?: boolean; // total $0: sin Webpay
  redirect?: string;
  error?: string;
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
  // Origen del comprador (utm/referrer), ver lib/attribution.ts. Solo trazabilidad.
  attribution?: Record<string, unknown> | null;
}
