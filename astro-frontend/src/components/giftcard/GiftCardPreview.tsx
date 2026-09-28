interface Props {
  image?: string;
  productName: string;
  variant?: string;
  recipient: string;
  message: string;
}

// Mockup de la tarjeta de regalo; el mismo diseño se usa en el correo (mandala-giftcards-email.php).
export default function GiftCardPreview({ image, productName, variant, recipient, message }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl bg-spa-charcoal text-white w-full">
      <div className="relative h-40 sm:h-48 bg-spa-sand">
        {image && <img src={image} alt={productName} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-spa-charcoal/80 via-spa-charcoal/10 to-transparent" />
        <span className="absolute top-4 left-5 font-editorial text-sm tracking-[0.4em] uppercase">Mándala</span>
        <span className="absolute top-4 right-5 text-[10px] tracking-[0.25em] uppercase text-white/80">Gift Card</span>
      </div>
      <div className="p-5 sm:p-6 space-y-3">
        <div>
          <p className="font-editorial text-xl leading-snug">{productName}</p>
          {variant && <p className="text-xs text-[#D4C3B3] mt-1">{variant}</p>}
        </div>
        <p className="text-sm italic text-white/85 leading-relaxed min-h-[2.75rem] break-words">
          {message ? `“${message}”` : '“Tu mensaje aparecerá aquí”'}
        </p>
        <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[11px] uppercase tracking-wide">
          <span className="text-white/60">Para</span>
          <span className="truncate ml-3 text-[#D4C3B3] normal-case tracking-normal text-xs">{recipient || 'destinatario@email.com'}</span>
        </div>
      </div>
    </div>
  );
}
