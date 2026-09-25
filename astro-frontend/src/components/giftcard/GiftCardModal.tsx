import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { addGiftCardToCart, isCartLoading } from '../../store/cartStore';
import type { GiftCardInput } from '../../types/giftcard';

const MESSAGE_LIMIT = 145;
const inputClass =
  'w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-sm bg-white focus:outline-none focus:border-spa-taupe placeholder:text-spa-taupe';
const labelClass = 'block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2';

const empty: GiftCardInput = { buyerEmail: '', recipientEmail: '', message: '' };

// Se abre al hacer click en cualquier [data-gift-product] de la página.
export default function GiftCardModal() {
  const [target, setTarget] = useState<{ id: number; name: string; variationId?: number } | null>(null);
  const [form, setForm] = useState<GiftCardInput>(empty);
  const [error, setError] = useState('');
  const loading = useStore(isCartLoading);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-gift-product]');
      if (!btn) return;
      setTarget({
        id: Number(btn.dataset.giftProduct),
        name: btn.dataset.giftName ?? '',
        variationId: btn.dataset.variationId ? Number(btn.dataset.variationId) : undefined,
      });
      setError('');
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  if (!target) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addGiftCardToCart(target!.id, form, target!.variationId);
      window.location.href = '/checkout';
    } catch (err) {
      setError((err as Error).message.replace(/<[^>]*>/g, ''));
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      onClick={() => setTarget(null)}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-editorial text-2xl text-spa-charcoal">Regalar como giftcard</h2>
            <p className="text-sm text-spa-taupe mt-1">{target.name}</p>
          </div>
          <button type="button" onClick={() => setTarget(null)} aria-label="Cerrar" className="text-spa-taupe text-2xl leading-none">
            ×
          </button>
        </div>

        <div>
          <label className={labelClass}>Tu email</label>
          <input required type="email" value={form.buyerEmail} onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email del destinatario</label>
          <input required type="email" value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} className={inputClass} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>Mensaje personalizado</label>
            <span className="text-[11px] text-spa-taupe">{form.message.length}/{MESSAGE_LIMIT}</span>
          </div>
          <textarea
            value={form.message}
            maxLength={MESSAGE_LIMIT}
            rows={3}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full border border-[#DDD5CA] rounded-2xl px-5 py-3 text-sm bg-white focus:outline-none focus:border-spa-taupe resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-spa-charcoal hover:bg-[#433B36] text-white rounded-full py-3.5 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase transition-all disabled:opacity-50"
        >
          {loading ? 'Agregando…' : 'Continuar al pago'}
        </button>
      </form>
    </div>
  );
}
