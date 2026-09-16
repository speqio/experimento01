import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartSummary, applyGiftCardBalance, isCartLoading } from '../../store/cartStore';

export default function CartSummaryPanel() {
  const summary = useStore(cartSummary);
  const loading = useStore(isCartLoading);
  const [code, setCode] = useState('');

  async function handleApplyGiftCard(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    await applyGiftCardBalance(code.trim());
    setCode('');
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{summary.subtotal}</span>
      </div>

      {summary.appliedCoupons.map((coupon) => (
        <div key={coupon.code} className="flex justify-between text-sm text-green-700">
          <span>Gift card {coupon.code}</span>
          <span>-{coupon.discountAmount}</span>
        </div>
      ))}

      <div className="flex justify-between font-medium">
        <span>Total {summary.needsPayment ? 'a pagar con Webpay' : ''}</span>
        <span>{summary.total}</span>
      </div>

      <form onSubmit={handleApplyGiftCard} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código de gift card"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="text-sm border rounded px-3 py-2 disabled:opacity-50"
        >
          Aplicar
        </button>
      </form>

      <a
        href="/checkout"
        className="block text-center bg-gray-900 text-white rounded py-2"
      >
        Ir a pagar
      </a>
    </div>
  );
}
