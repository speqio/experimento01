import type { ProductAttribute } from '../types/catalog';
import { cleanHtml, htmlToText, summarize } from './sanitize';

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

// Tagline corto bajo el título de la ficha de producto: no existe un campo
// ACF dedicado para esto en producción, así que se deriva de la primera
// oración real de `shortDescription` (ya limpia de HTML basura).
export function getProductTagline(shortDescriptionHtml: string): string | null {
  const withoutDuration = htmlToText(shortDescriptionHtml).replace(/Duraci[oó]n:.*$/i, '').trim();
  const firstSentence = withoutDuration.match(/^[^.!?]+[.!?]?/)?.[0]?.trim();
  return firstSentence || null;
}

// Algunos productos no tienen el atributo de variación "duracion", pero sí
// una oración suelta "Duración: 60 minutos." dentro de shortDescription (texto
// editorial, no un campo estructurado). Se extrae como fallback y se quita del
// resto para no mostrarla dos veces. `description` sale limpio (HTML seguro).
export function extractDuration(shortDescriptionHtml: string): { description: string; duration: string | null } {
  const clean = cleanHtml(shortDescriptionHtml);
  const match = clean.match(/<p>\s*Duraci[oó]n:\s*([^<]+?)\.?\s*<\/p>/i);
  if (!match) return { description: clean, duration: null };
  return { description: clean.replace(match[0], ''), duration: match[1].trim() };
}

/** Resumen de texto plano para las tarjetas del catálogo (sin HTML, sin duración). */
export function getCardSummary(shortDescriptionHtml: string, max = 140): string {
  const { description } = extractDuration(shortDescriptionHtml);
  return summarize(htmlToText(description), max);
}

// El `description` real de WooCommerce trae secciones editoriales marcadas
// con un párrafo/encabezado "Etiqueta:" seguido de un <ul> (Beneficios, Incluye,
// Indicado para, Contraindicaciones) — no son campos ACF separados. Se extraen
// para mostrarlas como bloques propios; lo que no calza queda en `intro`.
const SECTION_LABELS = {
  benefits: 'Beneficios(?:\\s+principales)?',
  includes: '(?:Incluye|Protocolo(?:\\s+incluido)?(?:\\s+en\\s+la\\s+sesi[oó]n)?)',
  indicatedFor: 'Indicad[oa]s?\\s+para',
  contraindications: 'Contraindicaciones',
} as const;

function extractListSection(html: string, label: string): { items: string[]; html: string } {
  const re = new RegExp(
    `<(p|h[2-4])>\\s*(?:<(?:strong|em)>)?\\s*${label}\\s*:?\\s*(?:</(?:strong|em)>)?\\s*</\\1>\\s*<(ul|ol)>([\\s\\S]*?)</\\2>`,
    'i',
  );
  const match = html.match(re);
  if (!match) return { items: [], html };
  const items = Array.from(match[3].matchAll(/<li>([\s\S]*?)<\/li>/gi))
    .map((m) => htmlToText(m[1]))
    .filter(Boolean);
  return { items, html: html.replace(match[0], '') };
}

export interface ProductSections {
  intro: string;
  benefits: string[];
  includes: string[];
  indicatedFor: string[];
  contraindications: string[];
}

export function parseProductSections(html: string): ProductSections {
  let rest = cleanHtml(html);
  const out: Record<keyof typeof SECTION_LABELS, string[]> = {
    benefits: [],
    includes: [],
    indicatedFor: [],
    contraindications: [],
  };
  for (const key of Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]) {
    const r = extractListSection(rest, SECTION_LABELS[key]);
    out[key] = r.items;
    rest = r.html;
  }
  // Etiquetas huérfanas ("Indicado para:" sin lista) no aportan nada: se descartan.
  rest = rest
    .replace(/<(p|h[2-4])>\s*(?:<(?:strong|em)>)?\s*(?:Indicad[oa]s?\s+para|Contraindicaciones)\s*:?\s*(?:<\/(?:strong|em)>)?\s*<\/\1>/gi, '')
    .trim();
  return { intro: rest, ...out };
}

// WooGraphQL devuelve `price`/`regularPrice` como rango ("$X - $Y") para
// VariableProduct (variantes de duración). Mostrar el rango completo es
// confuso; se muestra el valor más bajo con el prefijo "Desde".
export function formatPriceDisplay(price?: string | null): string {
  if (!price) return '';
  const [from] = price.split(' - ');
  return price.includes(' - ') ? `Desde ${from.trim()}` : price;
}
