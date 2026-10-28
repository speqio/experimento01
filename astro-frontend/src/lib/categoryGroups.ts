import type { ProductCategory } from '../types/catalog';

export interface CategoryGroup {
  label: string;
  items: ProductCategory[];
}

// Agrupa las categorías reales de WooCommerce (importadas del CSV) bajo las
// mismas familias editoriales del sistema de diseño (Faciales, Corporales,
// Masajes, Spa Day, Promociones). Los slugs vienen del catálogo real —
// ver `productCategories` en WPGraphQL — no de una lista estática.
const TIENDA_LABELS: Record<string, string> = { skincare: 'Skin care', bienestar: 'Bienestar', packs: 'Packs especiales' };
const GROUP_MATCHERS: { label: string; test: (slug: string) => boolean }[] = [
  { label: 'Tienda', test: (s) => s in TIENDA_LABELS },
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

// El CMS trae nombres en mayúsculas ("TRATAMIENTOS CORPORALES"); el menú los muestra con solo la primera letra en mayúscula.
export const sentenceCase = (name: string) => name.charAt(0).toLocaleUpperCase('es') + name.slice(1).toLocaleLowerCase('es');
/** Nombre visible de una categoría: el de Tienda si es de productos físicos, si no el del CMS con mayúscula inicial. */
export const categoryLabel = (slug: string, name: string) => TIENDA_LABELS[slug] ?? sentenceCase(name);
/** Categoría o producto físico (Skin care, Bienestar, Packs especiales), en vez de un servicio. */
export const isPhysicalCategory = (slug: string) => slug in TIENDA_LABELS;
export const isPhysicalProduct = (p: { productCategories?: { nodes: { slug: string }[] } | null }) =>
  (p.productCategories?.nodes ?? []).some((c) => isPhysicalCategory(c.slug));

export function groupCategories(categories: ProductCategory[]): CategoryGroup[] {
  const groups: CategoryGroup[] = GROUP_MATCHERS.map((m) => ({ label: m.label, items: [] }));

  for (const category of categories) {
    if (!category.count) continue;
    const matcher = GROUP_MATCHERS.find((m) => m.test(category.slug));
    if (!matcher) continue;
    const group = groups.find((g) => g.label === matcher.label)!;
    group.items.push({ ...category, name: categoryLabel(category.slug, category.name) });
  }

  return groups.filter((g) => g.items.length > 0).sort((a, b) => Number(a.label === 'Tienda') - Number(b.label === 'Tienda'));
}

/** Landing pages for whole service families; never select an arbitrary subcategory. */
const GROUP_PATHS: Record<string, string> = {
  Faciales: '/tratamientos-faciales/',
  Corporales: '/tratamientos-corporales/',
  Masajes: '/masajes/',
  'Spa Day': '/spa-day/',
  Promociones: '/promociones/',
  Tienda: '/tienda',
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
