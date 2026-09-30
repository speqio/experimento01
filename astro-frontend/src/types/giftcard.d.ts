// Producto comprado "como regalo": al pagarse se emite un cupón de 100%
// atado a ese producto (ver wordpress/mu-plugins/mandala-giftcards.php).
export interface GiftCardInput {
  buyerEmail: string;
  recipientEmail: string;
  message: string;
  // Fecha de envío del correo (YYYY-MM-DD). Vacío = se envía apenas se confirma el pago.
  deliveryDate?: string;
  // Foto que el comprador sube para reemplazar el diseño de la tarjeta (ver
  // api/gift-photo-upload.ts). URL ya en el WordPress del sitio, nunca externa —
  // el mu-plugin valida el host igual antes de guardarla en la orden.
  personalImageUrl?: string;
  // Presente solo cuando el regalo incluye un complemento agregado desde el modal
  // (mismo id en los 2+ cart items): WordPress agrupa por esto para emitir UN
  // cupón/correo que cubra todos los productos del grupo, en vez de uno por item.
  groupId?: string;
}
