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
// Tagline corto bajo el título de la ficha de producto: no existe un campo
// ACF dedicado para esto en producción, así que se deriva de la primera
// oración real de `shortDescription` en vez de inventar contenido.
export function getProductTagline(shortDescriptionHtml: string): string | null {
  const text = shortDescriptionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const withoutDuration = text.replace(/Duraci[oó]n:.*$/i, '').trim();
  const firstSentence = withoutDuration.match(/^[^.!?]+[.!?]?/)?.[0]?.trim();
  return firstSentence || null;
}

export function extractDuration(shortDescriptionHtml: string): { description: string; duration: string | null } {
  const match = shortDescriptionHtml.match(/<p>\s*(?:<span[^>]*>)?\s*Duraci[oó]n:\s*([^<.]+)\.?\s*(?:<\/span>)?\s*<\/p>\s*/i);
  if (!match) return { description: shortDescriptionHtml, duration: null };
  return { description: shortDescriptionHtml.replace(match[0], ''), duration: match[1].trim() };
}

// El `description` real de WooCommerce trae secciones editoriales marcadas
// con un <p>Etiqueta:</p> seguido de un <ul> (ej. "Beneficios:", "Incluye:")
// — no son campos ACF separados, es texto/HTML cargado en el CSV original.
// Se extraen para mostrarlas como bloques propios (protocolo/beneficios) en
// vez de dejarlas perdidas en un párrafo largo de descripción.
function extractListSection(html: string, label: string): { items: string[]; html: string } {
  const re = new RegExp(
    `<p>\\s*(?:<span[^>]*>)?\\s*${label}:?\\s*(?:<\\/span>)?\\s*<\\/p>\\s*<ul>([\\s\\S]*?)<\\/ul>`,
    'i'
  );
  const match = html.match(re);
  if (!match) return { items: [], html };
  const items = Array.from(match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );
  return { items, html: html.replace(match[0], '') };
}

export interface ProductSections {
  intro: string;
  benefits: string[];
  includes: string[];
}

export function parseProductSections(html: string): ProductSections {
  let rest = html;
  const benefits = extractListSection(rest, 'Beneficios');
  rest = benefits.html;
  const includes = extractListSection(rest, 'Incluye');
  rest = includes.html;
  // "Indicado para"/"Contraindicaciones" quedan en `intro` tal cual (texto
  // legal/clínico, se muestra igual que el resto de la descripción).
  return { intro: rest, benefits: benefits.items, includes: includes.items };
}
