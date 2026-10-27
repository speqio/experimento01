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

/** Familia editorial a la que pertenece una categoría (por su slug), si alguna. */
export function groupOf(slug: string): string | undefined {
  return GROUP_MATCHERS.find((m) => m.test(slug))?.label;
}

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

/** Landing pages for whole service families; never select an arbitrary subcategory. */
const GROUP_PATHS: Record<string, string> = {
  Faciales: '/tratamientos-faciales/',
  Corporales: '/tratamientos-corporales/',
  Masajes: '/masajes/',
  'Spa Day': '/spa-day/',
  Promociones: '/promociones/',
};
export function categoryGroupHref(label: string): string {
  return GROUP_PATHS[label] ?? '/tienda';
}

/** Current service family for landing pages, nested pages and category filters. */
export function categoryGroupForLocation(pathname: string, category?: string | null): string | undefined {
  if (category) return groupOf(category);
  const path = pathname.replace(/\/+$/, '') || '/';
  const landing = Object.entries(GROUP_PATHS).find(([, href]) => {
    const base = href.replace(/\/+$/, '');
    return path === base || path.startsWith(base + '/');
  });
  return landing?.[0] ?? groupOf(path.split('/').filter(Boolean).pop() ?? '');
}
