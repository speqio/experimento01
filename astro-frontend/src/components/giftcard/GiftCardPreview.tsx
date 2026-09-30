import { useEffect, useRef } from 'react';

interface Props {
  image?: string;
  productName: string;
  variant?: string;
  recipient: string;
  message: string;
  // Diseño de la tarjeta (wp-admin → Gift Cards → Ajustes); vacío = respaldo local.
  cardImageUrl?: string;
  // Foto que sube el comprador (api/gift-photo-upload.ts): si viene, reemplaza
  // todo el fondo de la tarjeta y se superpone el logo en una esquina.
  personalImageUrl?: string;
}

const MAX_ROT = 18;
const REST_SHADOW = '0 15px 35px rgba(0,0,0,0.25), 0 5px 15px rgba(0,0,0,0.2)';

// Tarjeta con efecto 3D (tilt + glare + sheen) y, debajo, el detalle del regalo en vivo.
// En el correo se usa una imagen estática equivalente (public/gift-card-email.jpg).
export default function GiftCardPreview({ image, productName, variant, recipient, message, cardImageUrl, personalImageUrl }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  function move(x: number, y: number, w: number, h: number) {
    const card = cardRef.current;
    const glare = glareRef.current;
    const sheen = sheenRef.current;
    if (!card || !glare || !sheen || reducedMotion.current) return;

    const xPct = (x / w - 0.5) * 2;
    const yPct = (y / h - 0.5) * 2;

    wrapperRef.current?.classList.remove('gc-float');
    card.style.transition = 'none';
    card.style.transform = `rotateX(${yPct * -MAX_ROT}deg) rotateY(${xPct * MAX_ROT}deg) scale3d(1.04,1.04,1.04)`;
    card.style.boxShadow = `${xPct * -25}px ${yPct * -25 + 15}px 40px rgba(0,0,0,0.4)`;

    glare.style.transition = 'opacity 0.2s ease';
    glare.style.opacity = '1';
    glare.style.background = `radial-gradient(circle at ${(x / w) * 100}% ${(y / h) * 100}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 65%)`;

    sheen.style.transition = 'none';
    sheen.style.transform = `translateX(${xPct * 100}%)`;
  }

  function leave() {
    const card = cardRef.current;
    const glare = glareRef.current;
    const sheen = sheenRef.current;
    if (!card || !glare || !sheen) return;

    card.style.transition = 'transform 0.6s cubic-bezier(0.23,1,0.32,1), box-shadow 0.6s cubic-bezier(0.23,1,0.32,1)';
    card.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    card.style.boxShadow = REST_SHADOW;
    glare.style.transition = 'opacity 0.6s ease';
    glare.style.opacity = '0';
    sheen.style.transition = 'transform 0.6s ease';
    sheen.style.transform = 'translateX(-100%)';

    window.setTimeout(() => {
      if (!reducedMotion.current) wrapperRef.current?.classList.add('gc-float');
    }, 600);
  }

  function onMouse(e: React.MouseEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    move(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
  }

  function onTouch(e: React.TouchEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    const t = e.touches[0];
    move(t.clientX - r.left, t.clientY - r.top, r.width, r.height);
  }

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
            {personalImageUrl && (
              // El diseño de fábrica ya trae el logo incorporado en el arte; la foto
              // del comprador no, así que se superpone acá (con un fondo oscuro
              // translúcido detrás para que se lea igual sobre fotos claras).
              <div
                className="absolute bottom-[5%] right-[5%] pointer-events-none rounded-lg px-2.5 py-1.5"
                style={{ background: 'rgba(20,18,16,0.45)', backdropFilter: 'blur(2px)' }}
              >
                <img src="/gift-card-logo.png" alt="Mándala Spa" className="h-5 sm:h-6 w-auto object-contain" />
              </div>
            )}
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
