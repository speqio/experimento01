export interface EcomItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

interface CartLine {
  quantity: number;
  total: string;
  product?: { databaseId: number; name: string } | null;
}

/** Números de un precio en CLP ("$65.000" o "Desde $65.000"). */
export function clp(text?: string | null): number {
  return Number((text ?? '').replace(/[^0-9]/g, '')) || 0;
}

export function cartLinesToItems(lines: CartLine[]): EcomItem[] {
  return lines
    .filter((l) => l.product)
    .map((l) => ({
      item_id: String(l.product!.databaseId),
      item_name: l.product!.name,
      price: clp(l.total) / (l.quantity || 1),
      quantity: l.quantity,
    }));
}

// GA4 recomienda vaciar `ecommerce` antes de cada evento para que no se mezclen datos.
export function pushEcommerce(event: string, ecommerce: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ ecommerce: null });
  w.dataLayer.push({ event, ...extra, ecommerce: { currency: 'CLP', ...ecommerce } });
}
