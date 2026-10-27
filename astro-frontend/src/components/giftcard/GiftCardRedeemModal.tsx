import { useModalDialog } from '../../lib/useModalDialog';
import { useState } from 'react';
import { useCardTilt, REST_SHADOW } from '../../lib/useCardTilt';

// ponytail: número de prueba para validar el flujo de verificación — volver a
// SITE_INFO.whatsapp cuando termine la prueba.
const TEST_WHATSAPP = '56961853899';

interface Props {
  // Diseño de la tarjeta (wp-admin → Gift Cards → Ajustes) — mismo arte que GiftCardPreview.
  cardImageUrl?: string;
}

// Botón flotante + modal para que quien recibió una gift card verifique su
// código y agende por WhatsApp — sin pasar por el checkout. El canje real
// (marcar el código como usado) sigue siendo manual en wp-admin o automático
// al aplicarlo en checkout; ver wordpress/mu-plugins/mandala-giftcards.php.
//
// El disparador es la misma tarjeta 3D del modal de compra (GiftCardPreview),
// en miniatura, con la etiqueta "Usa tu giftcard disponible" siempre visible
// (no solo al pasar el mouse) para que no pase desapercibida.
// Tamaño "medium" de WordPress para la proporción de la gift card (1748 × 1240): 300 × 213.
const thumb = (url: string) => (/\/wp-content\/uploads\/.+\.(webp|jpe?g|png)$/i.test(url) ? url.replace(/\.(\w+)$/, '-300x213.$1') : url);

export default function GiftCardRedeemModal({ cardImageUrl }: Props) {
  const full = cardImageUrl || '/gift-card.webp';
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog(open);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { wrapperRef, cardRef, glareRef, sheenRef, onMouse, onTouch, leave } = useCardTilt();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/gift-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), email: email.trim() }),
      });
      const data: { valid: boolean; reason?: string } = await res.json();
      if (!data.valid) {
        setError(data.reason || 'No se pudo verificar el código.');
        return;
      }
      const text = `Hola, quiero agendar mi gift card.\nNombre: ${name}\nCorreo: ${email}\nCódigo: ${code.trim()}`;
      window.location.href = `https://wa.me/${TEST_WHATSAPP}?text=${encodeURIComponent(text)}`;
    } catch {
      setError('No se pudo verificar el código. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes gc-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .gc-float { animation: gc-float 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .gc-float { animation: none; } }
      `}</style>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Usa tu giftcard disponible"
        className="fixed bottom-24 right-2 z-40 flex flex-col items-end gap-1.5 xl:flex-row xl:gap-2"
      >
        {/* Etiqueta siempre visible — no depende de hover ni click. Bajo 1280 px va encima de la tarjeta y en dos
            líneas, para que el botón ocupe solo el borde derecho y no tape el contenido (p. ej. los CTA del hero). */}
        <span className="max-w-[96px] text-center leading-tight rounded-xl xl:mb-1 xl:max-w-none xl:leading-normal xl:rounded-full xl:whitespace-nowrap bg-spa-charcoal text-white text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5 shadow-lg">
          Usa tu giftcard disponible
        </span>
        <div style={{ perspective: '800px' }}>
          <div
            ref={wrapperRef}
            className="gc-float relative w-[96px] xl:w-[140px]"
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
                overflow: 'hidden',
              }}
              role="img"
              aria-hidden="true"
            >
              {/* El botón mide 140 px: se usa la versión de 300 px que genera WordPress (~11 KB en vez de ~140 KB),
                  con prioridad baja para no competir con el banner; si no existe, cae a la imagen completa. */}
              <img
                src={thumb(full)}
                alt=""
                loading="lazy"
                fetchPriority="low"
                decoding="async"
                onError={(e) => { if (e.currentTarget.src !== new URL(full, location.href).href) e.currentTarget.src = full; }}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div ref={glareRef} className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'overlay', opacity: 0 }} />
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
      </button>

      {open && (
        <dialog ref={dialogRef} aria-labelledby="gift-redeem-title" aria-modal="true" className="fixed inset-0 z-[100] m-0 w-full h-full max-w-none max-h-none border-0 bg-black/50 flex items-center justify-center p-4" onCancel={(e) => { e.preventDefault(); setOpen(false); }} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div onClick={(e) => e.stopPropagation()} className="bg-spa-bg rounded-2xl w-full max-w-md max-h-full overflow-y-auto p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4 mb-5">
              <h2 id="gift-redeem-title" className="font-editorial text-2xl text-spa-charcoal">Verifica tu gift card</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="text-spa-taupe text-3xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="gift-redeem-field-1" className="block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2">Tu nombre</label>
                <input id="gift-redeem-field-1" required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spa-taupe-dark focus:ring-offset-2 focus:border-spa-taupe" />
              </div>
              <div>
                <label htmlFor="gift-redeem-field-2" className="block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2">Correo donde la recibiste</label>
                <input id="gift-redeem-field-2" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spa-taupe-dark focus:ring-offset-2 focus:border-spa-taupe" />
              </div>
              <div>
                <label htmlFor="gift-redeem-field-3" className="block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2">Código de regalo</label>
                <input id="gift-redeem-field-3" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spa-taupe-dark focus:ring-offset-2 focus:border-spa-taupe font-mono tracking-widest" />
              </div>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-spa-charcoal hover:bg-[#433B36] text-white rounded-full py-3.5 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase transition-all disabled:opacity-50"
              >
                {loading ? 'Verificando…' : 'Verificar y agendar por WhatsApp'}
              </button>
            </form>
          </div>
        </dialog>
      )}
    </>
  );
}
