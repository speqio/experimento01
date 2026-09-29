// Producto comprado "como regalo": al pagarse se emite un cupón de 100%
// atado a ese producto (ver wordpress/mu-plugins/mandala-giftcards.php).
export interface GiftCardInput {
  buyerEmail: string;
  recipientEmail: string;
  message: string;
  // Fecha de envío del correo (YYYY-MM-DD). Vacío = se envía apenas se confirma el pago.
  deliveryDate?: string;
}
