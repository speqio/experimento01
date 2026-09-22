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
    <div className="mt-10 pt-10 border-t border-spa-cream">
      <span className="text-xs font-semibold tracking-[0.2em] text-spa-taupe uppercase block mb-4">También te puede interesar</span>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {suggestions.map((product) => (
          <div key={product.databaseId} className="bg-white rounded-2xl border border-[#E8E2D7] p-3 text-sm">
            <a href={`/tienda/${product.slug}`} className="block">
              <img
                src={product.image.sourceUrl}
                alt={product.image.altText ?? product.name}
                className="w-full aspect-square object-cover arch-card mb-3"
              />
              <p className="font-editorial text-base text-spa-charcoal leading-snug line-clamp-2">{product.name}</p>
              <p className="text-spa-taupe mt-1">{product.price}</p>
            </a>
            <button
              type="button"
              disabled={loading}
              onClick={() => addToCart(product.databaseId, 1)}
              className="mt-3 w-full text-[11px] font-semibold tracking-wide uppercase bg-spa-sand hover:bg-[#E2DDD3] text-spa-charcoal rounded-full py-2 transition-colors disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
