import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { addGiftCardToCart, isCartLoading } from '../../store/cartStore';
import type { GiftCardInput } from '../../types/giftcard';
import GiftCardPreview from './GiftCardPreview';

const MESSAGE_LIMIT = 145;
const inputClass =
  'w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-sm bg-white focus:outline-none focus:border-spa-taupe placeholder:text-spa-taupe';
const labelClass = 'block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2';

const empty: GiftCardInput = { buyerEmail: '', recipientEmail: '', message: '', deliveryDate: '' };

// YYYY-MM-DD en la zona horaria local, para el min del selector de fecha.
function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function maxDeliveryDate(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  d.setDate(d.getDate() + 180);
  return d.toISOString().slice(0, 10);
}

interface Addon {
  id: number;
  name: string;
  price: string;
}

interface Target {
  id: number;
  name: string;
  image?: string;
  variant?: string;
  variationId?: number;
  // Complementos ("Complementa tu experiencia") disponibles para este producto —
  // mismos datos que la ficha de producto, ver tienda/[slug].astro.
  addons?: Addon[];
}

interface ModalProps {
  // Diseño de la tarjeta (wp-admin → Gift Cards → Ajustes), resuelto en ECommerceLayout.astro.
  cardImageUrl?: string;
}

// Se abre al hacer click en cualquier [data-gift-product] de la página.
export default function GiftCardModal({ cardImageUrl }: ModalProps) {
  const [target, setTarget] = useState<Target | null>(null);
  const [form, setForm] = useState<GiftCardInput>(empty);
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const loading = useStore(isCartLoading);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-gift-product]');
      if (!btn) return;
      let addons: Addon[] | undefined;
      if (btn.dataset.giftAddons) {
        try {
          addons = JSON.parse(btn.dataset.giftAddons);
        } catch {
          addons = undefined;
        }
      }
      setTarget({
        id: Number(btn.dataset.giftProduct),
        name: btn.dataset.giftName ?? '',
        image: btn.dataset.giftImage || undefined,
        variant: btn.dataset.giftVariant || undefined,
        variationId: btn.dataset.variationId ? Number(btn.dataset.variationId) : undefined,
        addons,
      });
      // Si la persona ya marcó el complemento en la ficha de producto (checkbox
      // [data-upsell-id] de "Complementa tu experiencia"), que abra premarcado acá
      // también — no debería tener que repetir el click.
      const checkedIds = new Set(
        [...document.querySelectorAll<HTMLInputElement>('[data-upsell-id]:checked')].map((el) => Number(el.dataset.upsellId))
      );
      setSelectedAddons((addons ?? []).filter((a) => checkedIds.has(a.id)).map((a) => a.id));
      setError('');
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  if (!target) return null;

  function toggleAddon(id: number) {
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si falla
    if (!file) return;
    setPhotoError('');
    setUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/gift-photo-upload', { method: 'POST', body });
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'No se pudo subir la foto.');
      setForm((f) => ({ ...f, personalImageUrl: data.url }));
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Con complementos seleccionados, todos los items comparten groupId: WordPress
      // los agrupa para emitir UN solo cupón/correo en vez de uno por producto.
      const payload: GiftCardInput = selectedAddons.length ? { ...form, groupId: crypto.randomUUID() } : form;
      await addGiftCardToCart(target!.id, payload, target!.variationId);
      for (const addonId of selectedAddons) {
        await addGiftCardToCart(addonId, payload);
      }
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
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-spa-bg rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 sm:pt-7">
          <div>
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-spa-taupe block mb-1">Un regalo para alguien especial</span>
            <h2 className="font-editorial text-2xl sm:text-3xl text-spa-charcoal">Regalar como giftcard</h2>
          </div>
          <button type="button" onClick={() => setTarget(null)} aria-label="Cerrar" className="text-spa-taupe text-3xl leading-none">
            ×
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 p-6 sm:p-8 items-start">
          <div className="md:sticky md:top-0">
            <GiftCardPreview
              image={target.image}
              productName={target.name}
              variant={target.variant}
              recipient={form.recipientEmail}
              message={form.message}
              cardImageUrl={cardImageUrl}
              personalImageUrl={form.personalImageUrl}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`${labelClass} mb-0`}>Personaliza el diseño con tu foto (opcional)</label>
                {form.personalImageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, personalImageUrl: undefined }))}
                    className="text-[11px] text-spa-taupe underline underline-offset-2"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingPhoto}
                onChange={handlePhotoChange}
                className="w-full text-xs text-spa-taupe file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-spa-cream file:text-spa-charcoal file:text-xs file:font-semibold file:uppercase file:tracking-wide"
              />
              <p className="text-[11px] text-spa-taupe mt-1.5">
                {uploadingPhoto
                  ? 'Subiendo tu foto…'
                  : form.personalImageUrl
                    ? 'Tu foto reemplaza el diseño de la tarjeta (el logo queda encima).'
                    : 'JPEG, PNG o WebP, hasta 5MB. Si no subes nada, se usa el diseño de fábrica.'}
              </p>
              {photoError && <p className="text-sm text-red-600 mt-1">{photoError}</p>}
            </div>

            {target.addons && target.addons.length > 0 && (
              <div className="rounded-xl border border-[#DDD5CA] bg-white p-4">
                <span className={`${labelClass} mb-3`}>Agregar al regalo</span>
                <div className="space-y-2.5">
                  {target.addons.map((a) => (
                    <label key={a.id} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#2C2724]"
                        checked={selectedAddons.includes(a.id)}
                        onChange={() => toggleAddon(a.id)}
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-spa-charcoal leading-snug">{a.name}</span>
                        <span className="block text-sm font-bold text-spa-taupe-dark">{a.price}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-spa-taupe mt-2.5">
                  Se incluye en el mismo regalo: un solo código, un solo correo.
                </p>
              </div>
            )}

            <div>
              <label className={labelClass}>Fecha de envío (opcional)</label>
              <input
                type="date"
                value={form.deliveryDate ?? ''}
                min={todayLocal()}
                max={maxDeliveryDate()}
                onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                className={inputClass}
              />
              <p className="text-[11px] text-spa-taupe mt-1.5">
                {form.deliveryDate
                  ? `Le llegará el correo el ${new Date(form.deliveryDate + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                  : 'Déjalo vacío para enviarlo apenas se confirme el pago.'}
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || uploadingPhoto}
              className="w-full bg-spa-charcoal hover:bg-[#433B36] text-white rounded-full py-3.5 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase transition-all disabled:opacity-50"
            >
              {uploadingPhoto ? 'Subiendo foto…' : loading ? 'Agregando…' : 'Continuar al pago'}
            </button>
            <p className="text-[11px] text-spa-taupe text-center">
              {form.deliveryDate
                ? 'El destinatario recibirá su código el día que elegiste.'
                : 'El destinatario recibirá un correo con su código una vez confirmado el pago.'}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
