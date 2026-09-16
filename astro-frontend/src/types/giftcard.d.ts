export interface GiftCardInput {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  message: string;
  deliveryDate?: string;
  amount: number;
}

// Saldo/crédito de tienda: aplicable parcialmente y combinable con Webpay
// por el remanente (ver docs/schema-spec.md §4.3).
export interface GiftCardBalance {
  code: string;
  remainingBalance: number;
  originalAmount: number;
  expiresAt?: string;
}
