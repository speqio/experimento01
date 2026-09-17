import type { ProductCategory } from '../types/catalog';

export interface CategoryGroup {
  label: string;
  items: ProductCategory[];
}

// Agrupa las categorías reales de WooCommerce (importadas del CSV) bajo las
// mismas familias editoriales del sistema de diseño (Faciales, Corporales,
// Masajes, Spa Day, Promociones). Los slugs vienen del catálogo real —
// ver `productCategories` en WPGraphQL — no de una lista estática.
const GROUP_MATCHERS: { label: string; test: (slug: string) => boolean }[] = [
  { label: 'Faciales', test: (s) => s.includes('facial') },
  { label: 'Corporales', test: (s) => s.includes('corporal') || s.includes('drenaje') || s.includes('espalda') },
  { label: 'Masajes', test: (s) => s.includes('masaje') },
  { label: 'Spa Day', test: (s) => s.includes('spa-day') || s.includes('spa-mix') },
  { label: 'Promociones', test: (s) => s.includes('promocion') || s.includes('packs') || s.includes('convenios') },
];

export function groupCategories(categories: ProductCategory[]): CategoryGroup[] {
  const groups: CategoryGroup[] = GROUP_MATCHERS.map((m) => ({ label: m.label, items: [] }));

  for (const category of categories) {
    if (!category.count) continue;
    const matcher = GROUP_MATCHERS.find((m) => m.test(category.slug));
    if (!matcher) continue;
    const group = groups.find((g) => g.label === matcher.label)!;
    group.items.push(category);
  }

  return groups.filter((g) => g.items.length > 0);
}
