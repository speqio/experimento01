// Limpieza del HTML que viene de WooCommerce (descripcion / descripcion corta).
// Muchas fichas tienen basura pegada desde ChatGPT/Word (`<div data-turn-id-container=...>`,
// `<section class="text-token-...">`, spans con estilos inline). Se deja solo una lista
// blanca de etiquetas SIN atributos (salvo `href` en enlaces).
const ALLOWED = new Set(['p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'h2', 'h3', 'h4', 'a']);
const BLOCK = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'blockquote', 'table', 'tr', 'td', 'pre']);
const RENAME: Record<string, string> = { b: 'strong', i: 'em', h1: 'h2', h5: 'h4', h6: 'h4' };

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&#8217;|&#039;|&#x27;/g, "'")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function cleanHtml(html?: string | null): string {
  if (!html) return '';
  let out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    // El motor de ChatGPT deja `<div>`/`<section>`/`<span>` anidados: se descartan (abajo).
    .replace(/<\/?([a-z][a-z0-9]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi, (tag, rawName: string, attrs: string) => {
      const closing = tag.startsWith('</');
      let name = rawName.toLowerCase();
      name = RENAME[name] ?? name;
      if (!ALLOWED.has(name)) return BLOCK.has(name) ? ' ' : '';
      if (closing) return `</${name}>`;
      if (name === 'a') {
        const href = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
        const url = href?.[2] ?? href?.[3];
        return url && /^(https?:|\/|mailto:|tel:)/i.test(url) ? `<a href="${url}" rel="noopener">` : '<a>';
      }
      if (name === 'br') return '<br>';
      return `<${name}>`;
    });

  out = out
    .replace(/&nbsp;/g, ' ')
    .replace(/<(p|li|h2|h3|h4|strong|em)>\s*<\/\1>/gi, '') // vacíos
    .replace(/<p>\s*(?:<br>\s*)+<\/p>/gi, '')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  // Texto suelto sin <p> (quedó de un <div>): se envuelve para no perderlo.
  if (out && !/^<(p|ul|ol|h[2-4])/i.test(out)) out = `<p>${out}</p>`;
  return out;
}

/** Texto plano (para tarjetas, meta description, taglines). */
export function htmlToText(html?: string | null): string {
  return decodeBasicEntities(cleanHtml(html).replace(/<\/(p|li|h[2-4])>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resumen corto sin cortar palabras (para las tarjetas del catálogo). */
export function summarize(text: string, max = 140): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = cut.match(/^(.{60,}?[.!?])\s/);
  if (sentence) return sentence[1];
  return cut.replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '…';
}
