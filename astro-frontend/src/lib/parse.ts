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

// El `description` real de WooCommerce sigue (casi siempre) un formato editorial:
// un párrafo de introducción y luego secciones marcadas con una etiqueta
// ("Beneficios:", "Incluye:", "Indicado para:", "Contraindicaciones:") seguida de una
// lista o de un párrafo. La etiqueta puede venir como <p>Etiqueta:</p> o como encabezado.
// Aquí se recorre el HTML ya limpio por bloques y se clasifica cada sección; lo que no
// encaja en las cinco estándar se conserva en `extras` (p. ej. "Modo de uso").
export type SectionKey = 'benefits' | 'includes' | 'indicatedFor' | 'contraindications';

const SECTION_ALIASES: [SectionKey, RegExp][] = [
  ['benefits', /^beneficios\b/],
  ['includes', /^(que incluye\b.*|.*\bincluye|protocolo\b.*)$/],
  ['indicatedFor', /^(indicad[oa]s? para|ideal para( personas con)?)$/],
  ['contraindications', /^contraindicaciones$/],
];

export interface ProductSections {
  intro: string;
  benefits: string[];
  includes: string[];
  indicatedFor: string[];
  contraindications: string[];
  extras: { title: string; html: string }[];
}

const normLabel = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[¿\s]+/, '')
    .replace(/[?:.\s]+$/g, '')
    .trim();

function classify(label: string): SectionKey | null {
  const n = normLabel(label);
  for (const [key, re] of SECTION_ALIASES) if (re.test(n)) return key;
  return null;
}

export function parseProductSections(html: string): ProductSections {
  // Se descartan los párrafos con listas de precios por sesión ("1 sesión $60.000 – 1 hora
  // <br> 4 sesiones …"): duplican las variaciones de WooCommerce, que ya muestran los precios.
  const isPriceList = (blk: string) => {
    if (!blk.startsWith('<p>')) return false;
    const t = htmlToText(blk);
    return t.length < 600 && /\$\s?\d/.test(t) && /sesi[oó]n|sesiones|\bhoras?\b|minutos/i.test(t);
  };
  const blocks = (cleanHtml(html).match(/<(p|ul|ol|h[2-4])>[\s\S]*?<\/\1>/g) ?? []).filter((b) => !isPriceList(b));
  const result: ProductSections = { intro: '', benefits: [], includes: [], indicatedFor: [], contraindications: [], extras: [] };
  const intro: string[] = [];
  let seenKnown = false;

  let current: { key: SectionKey | null; title: string; level: number; blocks: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const items: string[] = [];
    // Los subtítulos (h3/h4) dentro de una sección se funden con el párrafo que les sigue.
    let pendingTitle = '';
    for (const blk of current.blocks) {
      if (/^<(ul|ol)>/.test(blk)) {
        if (pendingTitle) items.push(pendingTitle);
        pendingTitle = '';
        for (const li of blk.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
          const t = htmlToText(li[1]);
          if (t) items.push(t);
        }
      } else if (/^<h[2-4]>/.test(blk)) {
        if (pendingTitle) items.push(pendingTitle);
        pendingTitle = htmlToText(blk);
      } else {
        // Párrafo con viñetas manuales ("✔ a<br>✔ b"): cada línea es un ítem.
        const lines = blk
          .replace(/^<p>|<\/p>$/g, '')
          .split(/<br>/)
          .map((l) => htmlToText(l).replace(/^[✔✓•·\-–]\s*/, ''))
          .filter(Boolean);
        if (lines.length > 1) {
          if (pendingTitle) items.push(pendingTitle);
          items.push(...lines);
        } else if (lines[0]) {
          items.push(pendingTitle ? `${pendingTitle}: ${lines[0]}` : lines[0]);
        } else if (pendingTitle) {
          items.push(pendingTitle);
        }
        pendingTitle = '';
      }
    }
    if (pendingTitle) items.push(pendingTitle);
    if (current.key) result[current.key].push(...items);
    else if (current.blocks.length) result.extras.push({ title: current.title, html: current.blocks.join('') });
    current = null;
  };

  for (const blk of blocks) {
    const tag = blk.match(/^<(\w+)>/)![1];
    const text = htmlToText(blk);
    const isHeading = /^h[2-4]$/.test(tag);
    const isLabelPara = tag === 'p' && text.length <= 60 && (/:$/.test(text) || classify(text) !== null);

    // Un h3/h4 dentro de una sección abierta con h2 (o etiqueta) es contenido de esa sección.
    const level = isHeading ? Number(tag[1]) : 2;
    const known = isHeading || isLabelPara ? classify(text) : null;
    // Un subtítulo desconocido (h3/h4) dentro de una sección estándar es contenido de ella
    // (p. ej. cada tratamiento bajo "¿Qué incluye…?"); un subtítulo estándar abre sección propia.
    const nested = isHeading && current !== null && current.key !== null && level > current.level && known === null;

    if ((isHeading || isLabelPara) && !nested) {
      // Un encabezado desconocido antes de cualquier sección estándar es el título de la
      // intro (no abre un bloque aparte); después de una sección estándar abre un extra.
      if (known === null && isHeading && !seenKnown) {
        intro.push(blk);
        continue;
      }
      flush();
      // Un párrafo-etiqueta desconocido solo abre bloque si termina en ":".
      if (known || isHeading || /:$/.test(text)) {
        if (known) seenKnown = true;
        current = { key: known, title: text.replace(/[:\s]+$/, ''), level, blocks: [] };
        continue;
      }
    }
    if (current) current.blocks.push(blk);
    else intro.push(blk);
  }
  flush();

  result.intro = intro.join('');
  return result;
}

// WooGraphQL devuelve `price`/`regularPrice` como rango ("$X - $Y") para
// VariableProduct (variantes de duración). Mostrar el rango completo es
// confuso; se muestra el valor más bajo con el prefijo "Desde".
export function formatPriceDisplay(price?: string | null): string {
  if (!price) return '';
  const [from] = price.split(' - ');
  return price.includes(' - ') ? `Desde ${from.trim()}` : price;
}

// Números de un precio de WooGraphQL ("$65.000" o rango "$65.000 - $239.200", CLP sin decimales).
function priceBounds(price?: string | null): [number, number] | null {
  if (!price) return null;
  const nums = price
    .split(' - ')
    .map((part) => Number(part.replace(/[^0-9]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

/**
 * Precio a mostrar y precio tachado. Solo se tacha cuando la opción que se muestra
 * (la más barata en un rango) realmente tiene descuento; comparar los textos completos
 * del rango tachaba un "Desde $65.000" igual al precio vigente.
 */
export function getPriceDisplay(price?: string | null, regularPrice?: string | null): { current: string; original: string | null } {
  const current = formatPriceDisplay(price);
  const p = priceBounds(price);
  const r = priceBounds(regularPrice);
  if (!p || !r || r[0] <= p[0]) return { current, original: null };
  return { current, original: formatPriceDisplay(regularPrice) };
}

/** ¿Alguna opción del producto está rebajada? (para la página de promociones). */
export function hasAnyDiscount(price?: string | null, regularPrice?: string | null): boolean {
  const p = priceBounds(price);
  const r = priceBounds(regularPrice);
  return Boolean(p && r && (r[0] > p[0] || r[1] > p[1]));
}
