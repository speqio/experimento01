import { useCardTilt, REST_SHADOW } from '../../lib/useCardTilt';

interface Props {
  image?: string;
  productName: string;
  summary?: string;
  variant?: string;
  recipient: string;
  message: string;
  // Diseño de la tarjeta (wp-admin → Gift Cards → Ajustes); vacío = respaldo local.
  cardImageUrl?: string;
  // Foto que sube el comprador (api/gift-photo-upload.ts): si viene, reemplaza
  // todo el fondo de la tarjeta. Ya viene compuesta con el logo (composeCard en GiftCardModal.tsx).
  personalImageUrl?: string;
}

// Tarjeta con efecto 3D (tilt + glare + sheen) y, debajo, el detalle del regalo en vivo.
// En el correo se usa una imagen estática equivalente (public/gift-card-email.jpg).
export default function GiftCardPreview({ image, productName, summary, variant, recipient, message, cardImageUrl, personalImageUrl }: Props) {
  const { wrapperRef, cardRef, glareRef, sheenRef, onMouse, onTouch, leave } = useCardTilt();

  return (
    <div className="w-full">
      <style>{`
        @keyframes gc-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .gc-float { animation: gc-float 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .gc-float { animation: none; } }
      `}</style>

      <div style={{ perspective: '1200px' }} className="relative py-2">
        <div
          ref={wrapperRef}
          className="gc-float relative cursor-pointer"
          style={{ aspectRatio: '1748 / 1240', transformStyle: 'preserve-3d', touchAction: 'pan-y' }}
          onMouseMove={onMouse}
          onMouseLeave={leave}
          onTouchMove={onTouch}
          onTouchEnd={leave}
        >
          <div
            ref={cardRef}
            className="relative w-full h-full"
            style={{
              borderRadius: '4.5% / 6.4%',
              transformStyle: 'preserve-3d',
              boxShadow: REST_SHADOW,
              transition: 'transform 0.6s cubic-bezier(0.23,1,0.32,1), box-shadow 0.6s cubic-bezier(0.23,1,0.32,1)',
              backgroundImage: `url('${personalImageUrl || cardImageUrl || '/gift-card.webp'}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              overflow: 'hidden',
            }}
            role="img"
            aria-label="Gift Card Mándala Spa"
          >
            <div
              ref={glareRef}
              className="absolute inset-0 pointer-events-none"
              style={{ mixBlendMode: 'overlay', opacity: 0, transition: 'opacity 0.6s ease' }}
            />
            <div
              ref={sheenRef}
              className="absolute pointer-events-none"
              style={{
                inset: '-100%',
                mixBlendMode: 'color-dodge',
                transform: 'translateX(-100%)',
                background:
                  'linear-gradient(105deg, transparent, transparent 40%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.2) 55%, transparent 60%, transparent)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Detalle del regalo (en vivo) */}
      <div className="mt-5 bg-white rounded-2xl border border-[#E8E2D7] p-4 space-y-3">
        <div className="flex items-center gap-3">
          {image && <img src={image} alt={productName} className="w-14 h-14 rounded-xl object-cover shrink-0" />}
          <div className="min-w-0">
            <p className="font-editorial text-lg leading-snug text-spa-charcoal">{productName}</p>
            {variant && <p className="text-xs text-spa-taupe mt-0.5">{variant}</p>}
          </div>
        </div>
        {summary && <p className="text-xs text-spa-taupe-dark leading-relaxed">{summary}</p>}
        <p className="text-sm italic text-spa-taupe-dark leading-relaxed break-words min-h-[2.5rem]">
          {message ? `“${message}”` : '“Tu mensaje aparecerá aquí”'}
        </p>
        <div className="pt-3 border-t border-spa-sand flex items-center justify-between gap-3 text-xs">
          <span className="uppercase tracking-wide text-spa-taupe">Para</span>
          <span className="truncate text-spa-charcoal">{recipient || 'destinatario@email.com'}</span>
        </div>
      </div>
    </div>
  );
}
