import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  cartSummary,
  fetchCart,
  updateItemQuantity,
  removeCartItem,
  applyGiftCardBalance,
  isCartLoading,
} from '../../store/cartStore';

export default function CartSummaryPanel() {
  const summary = useStore(cartSummary);
  const loading = useStore(isCartLoading);
  const [code, setCode] = useState('');

  useEffect(() => {
    fetchCart();
  }, []);

  async function handleApplyGiftCard(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    await applyGiftCardBalance(code.trim());
    setCode('');
  }

  if (!loading && summary.items.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-[#E8E2D7]">
        <p className="text-spa-taupe mb-6">Tu carrito está vacío.</p>
        <a
          href="/tienda"
          className="inline-block bg-spa-charcoal hover:bg-[#433B36] text-white px-8 py-3.5 rounded-full text-xs font-semibold tracking-[0.2em] uppercase transition-all duration-300"
        >
          Ver tienda
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-[#E8E2D7] divide-y divide-spa-cream">
        {summary.items.map((item) => (
          <div key={item.key} className="flex items-center gap-4 p-4 sm:p-5">
            {item.product.image?.sourceUrl ? (
              <img
                src={item.product.image.sourceUrl}
                alt={item.product.image.altText ?? item.product.name}
                className="w-20 h-20 object-cover arch-card shrink-0"
              />
            ) : (
              <div className="w-20 h-20 bg-spa-sand arch-card shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <a
                href={`/tienda/${item.product.slug}`}
                className="font-editorial text-lg text-spa-charcoal hover:text-spa-taupe transition-colors line-clamp-1"
              >
                {item.product.name}
              </a>
              <div className="flex items-center gap-3 mt-2">
                <label className="text-xs text-spa-taupe uppercase tracking-wide">Cant.</label>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  disabled={loading}
                  onChange={(e) => updateItemQuantity(item.key, Number(e.target.value))}
                  className="w-16 border border-[#DDD5CA] rounded-full px-3 py-1 text-sm text-center"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => removeCartItem(item.key)}
                  className="text-xs text-spa-taupe hover:text-spa-charcoal underline transition-colors disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
            <span className="font-semibold text-spa-charcoal whitespace-nowrap">{item.total}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E2D7] p-6 space-y-4">
        <div className="flex justify-between text-sm text-spa-taupe">
          <span>Subtotal</span>
          <span>{summary.subtotal}</span>
        </div>

        {summary.appliedCoupons.map((coupon) => (
          <div key={coupon.code} className="flex justify-between text-sm text-emerald-700">
            <span>Gift card {coupon.code}</span>
            <span>-{coupon.discountAmount}</span>
          </div>
        ))}

        <div className="flex justify-between items-baseline pt-4 border-t border-spa-cream">
          <span className="font-editorial text-lg text-spa-charcoal">
            Total {summary.needsPayment ? '· a pagar con Webpay' : ''}
          </span>
          <span className="font-editorial text-2xl text-spa-charcoal font-medium">{summary.total}</span>
        </div>

        <form onSubmit={handleApplyGiftCard} className="flex gap-2 pt-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de gift card"
            className="flex-1 border border-[#DDD5CA] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-spa-taupe"
          />
          <button
            type="submit"
            disabled={loading}
            className="text-xs font-semibold tracking-wide uppercase border border-[#DDD5CA] rounded-full px-5 py-2.5 hover:bg-spa-sand transition-colors disabled:opacity-50"
          >
            Aplicar
          </button>
        </form>

        <a
          href="/checkout"
          className="block text-center bg-spa-charcoal hover:bg-[#433B36] text-white rounded-full py-3.5 text-xs font-semibold tracking-[0.2em] uppercase transition-all duration-300 shadow-md"
        >
          Ir a pagar
        </a>
      </div>
    </div>
  );
}
