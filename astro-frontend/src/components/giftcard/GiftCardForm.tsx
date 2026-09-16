import { useState } from 'react';
import { addGiftCardToCart, isCartLoading } from '../../store/cartStore';
import { useStore } from '@nanostores/react';
import type { GiftCardInput } from '../../types/giftcard';

interface Props {
  productId: number;
}

const defaultForm: GiftCardInput = {
  recipientName: '',
  recipientEmail: '',
  senderName: '',
  message: '',
  amount: 20000,
};

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
    return <p className="text-sm text-green-700">Gift card agregada al carrito.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <div>
        <label className="block text-sm font-medium">Nombre del destinatario</label>
        <input
          required
          value={form.recipientName}
          onChange={(e) => update('recipientName', e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Email del destinatario</label>
        <input
          required
          type="email"
          value={form.recipientEmail}
          onChange={(e) => update('recipientEmail', e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Tu nombre</label>
        <input
          required
          value={form.senderName}
          onChange={(e) => update('senderName', e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Mensaje</label>
        <textarea
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Monto (CLP)</label>
        <input
          required
          type="number"
          min={5000}
          step={1000}
          value={form.amount}
          onChange={(e) => update('amount', Number(e.target.value))}
          className="w-full border rounded px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-gray-900 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {loading ? 'Agregando…' : 'Agregar al carrito'}
      </button>
    </form>
  );
}
