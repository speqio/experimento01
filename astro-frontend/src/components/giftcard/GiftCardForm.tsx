import { useState } from 'react';
import { addGiftCardToCart, isCartLoading } from '../../store/cartStore';
import { useStore } from '@nanostores/react';
import type { GiftCardInput } from '../../types/giftcard';

interface Props {
  productId: number;
}

const AMOUNT_PRESETS = [20000, 35000, 50000, 80000];
const MESSAGE_LIMIT = 145;

const defaultForm: GiftCardInput = {
  recipientName: '',
  recipientEmail: '',
  senderName: '',
  message: '',
  amount: AMOUNT_PRESETS[0],
};

const inputClass =
  'w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-sm bg-white focus:outline-none focus:border-spa-taupe placeholder:text-spa-taupe';
const labelClass = 'block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2';

export default function GiftCardForm({ productId }: Props) {
  const [form, setForm] = useState<GiftCardInput>(defaultForm);
  const [done, setDone] = useState(false);
  const loading = useStore(isCartLoading);

  function update<K extends keyof GiftCardInput>(key: K, value: GiftCardInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addGiftCardToCart(productId, form);
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E2D7]">
        <p className="text-spa-charcoal font-editorial text-xl mb-2">¡Listo!</p>
        <p className="text-sm text-spa-taupe">Gift card agregada al carrito.</p>
        <a
          href="/carrito"
          className="inline-block mt-6 bg-spa-charcoal hover:bg-[#433B36] text-white px-8 py-3 rounded-full text-xs font-semibold tracking-[0.2em] uppercase transition-all"
        >
          Ir al carrito
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Preview del voucher */}
      <div className="arch-card bg-white border border-[#E8E2D7] p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-spa-charcoal text-white flex items-center justify-center font-editorial text-sm">M</div>
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-spa-charcoal">Mándala Spa</p>
            <p className="text-[11px] text-spa-taupe">Las Condes · Santiago</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-spa-taupe">Para</p>
            <p className="text-spa-charcoal font-medium truncate">{form.recipientName || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-spa-taupe">De</p>
            <p className="text-spa-charcoal font-medium truncate">{form.senderName || '—'}</p>
          </div>
        </div>
        {form.message && (
          <p className="mt-4 text-sm text-spa-taupe italic leading-relaxed line-clamp-2">“{form.message}”</p>
        )}
        <div className="mt-6 pt-4 border-t border-spa-cream flex items-baseline justify-between">
          <span className="text-xs text-spa-taupe uppercase tracking-wide">Vigencia 90 días</span>
          <span className="font-editorial text-2xl text-spa-charcoal font-medium">${form.amount.toLocaleString('es-CL')}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl border border-[#E8E2D7] p-6 sm:p-8">
        <div>
          <label className={labelClass}>Monto</label>
          <div className="grid grid-cols-4 gap-2">
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => update('amount', preset)}
                className={`py-2.5 rounded-full text-xs font-semibold transition-colors ${
                  form.amount === preset
                    ? 'bg-spa-charcoal text-white'
                    : 'bg-spa-sand text-spa-charcoal hover:bg-[#E2DDD3]'
                }`}
              >
                ${preset / 1000}k
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Nombre del destinatario</label>
          <input
            required
            value={form.recipientName}
            onChange={(e) => update('recipientName', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email del destinatario</label>
          <input
            required
            type="email"
            value={form.recipientEmail}
            onChange={(e) => update('recipientEmail', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Tu nombre</label>
          <input
            required
            value={form.senderName}
            onChange={(e) => update('senderName', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>Dedicatoria</label>
            <span className="text-[11px] text-spa-taupe">{form.message.length}/{MESSAGE_LIMIT}</span>
          </div>
          <textarea
            value={form.message}
            maxLength={MESSAGE_LIMIT}
            rows={3}
            onChange={(e) => update('message', e.target.value)}
            className="w-full border border-[#DDD5CA] rounded-2xl px-5 py-3 text-sm bg-white focus:outline-none focus:border-spa-taupe resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-spa-charcoal hover:bg-[#433B36] text-white rounded-full py-3.5 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase transition-all duration-300 shadow-md disabled:opacity-50"
        >
          {loading ? 'Agregando…' : 'Agregar al carrito'}
        </button>
      </form>
    </div>
  );
}
