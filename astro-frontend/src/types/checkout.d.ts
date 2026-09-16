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
