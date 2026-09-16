import { useStore } from '@nanostores/react';
import { addToCart, isCartLoading } from '../../store/cartStore';
import type { SimpleProduct } from '../../types/catalog';

interface Props {
  // Upsell/cross-sell nativo de WooCommerce, configurado en el admin
  // (ver docs/schema-spec.md §4.1) — este widget solo lo muestra.
  suggestions: Pick<SimpleProduct, 'databaseId' | 'name' | 'slug' | 'price' | 'image'>[];
}

export default function CheckoutUpsell({ suggestions }: Props) {
  const loading = useStore(isCartLoading);

  if (!suggestions.length) return null;

  return (
    <div className="border rounded-lg p-4 mt-6">
      <h3 className="font-medium mb-3">También te puede interesar</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {suggestions.map((product) => (
          <div key={product.databaseId} className="border rounded p-3 text-sm">
            <img
              src={product.image.sourceUrl}
              alt={product.image.altText ?? product.name}
              className="w-full aspect-square object-cover rounded mb-2"
            />
            <p className="font-medium">{product.name}</p>
            <p className="text-gray-600">{product.price}</p>
            <button
              type="button"
              disabled={loading}
              onClick={() => addToCart(product.databaseId, 1)}
              className="mt-2 w-full text-xs bg-gray-900 text-white rounded py-1 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
