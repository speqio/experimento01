import type { ProductAttribute } from '../types/catalog';

// Los productos WooCommerce importados modelan la duración como un atributo
// de variación (nombre "duracion"/"horas"/"hora", ej. "1 hora y media") en
// vez de un campo dedicado — se toma la primera opción como duración base.
export function getProductDuration(attributes?: { nodes: ProductAttribute[] } | null): string | null {
  const durationAttr = attributes?.nodes?.find((a) => /hora|duracion/i.test(a.name));
  return durationAttr?.options?.[0] ?? null;
}

// Los productos "para dos" (masajes/faciales en pareja) se marcan en el
// título con el prefijo "Para dos:" en el catálogo importado — no hay un
// campo/categoría dedicado para "cabina doble", así que se deriva del nombre.
export function getProductBadge(name: string): string | null {
  return /^para\s*dos\b/i.test(name.trim()) ? 'Cabina Doble' : null;
}

// Algunos productos no tienen el atributo de variación "duracion", pero sí
// una oración suelta "Duración: 60 minutos." al final de shortDescription
// (texto editorial cargado en el CSV, no un campo estructurado). Se extrae
// como fallback y se quita de la descripción para no mostrarla dos veces.
export function extractDuration(shortDescriptionHtml: string): { description: string; duration: string | null } {
  const match = shortDescriptionHtml.match(/<p>\s*(?:<span[^>]*>)?\s*Duraci[oó]n:\s*([^<.]+)\.?\s*(?:<\/span>)?\s*<\/p>\s*/i);
  if (!match) return { description: shortDescriptionHtml, duration: null };
  return { description: shortDescriptionHtml.replace(match[0], ''), duration: match[1].trim() };
}
