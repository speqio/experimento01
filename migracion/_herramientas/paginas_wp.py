"""Extrae del WXR de producción las páginas que el sitio nuevo publica en la misma URL.

Uso: python -I migracion/_herramientas/paginas_wp.py <wxr.xml> <paginas.json> <entradas.json>
Solo texto (títulos, párrafos, listas, enlaces internos): las imágenes y el maquetado de Elementor no se copian.
"""
import html, json, re, sys
from html.parser import HTMLParser

# Página de producción -> categorías de WooCommerce que lista (vacío = solo contenido).
CATEGORIAS = {
    'masajes': ['masajes'], 'masajes-relajantes': ['masajes-relajantes'],
    'masajes-descontracturantes': ['masajes-descontracturantes'], 'masaje-mixto': ['masaje-mixto'],
    'masaje-para-dos': ['masaje-para-dos'], 'masaje-para-embarazadas': ['masajes-para-embarazadas'],
    'tratamientos-corporales': ['tratamientos-corporales'], 'tratamientos-reductivos': ['tratamientos-reductivos'],
    'tratamientos-reductivos-spamandala': ['tratamientos-reductivos'], 'limpieza-de-espalda-spamandala': ['limpieza-espalda'],
    'drenaje-linfatico': ['drenaje-linfatico'], 'drenaje-linfatico-embarazadas': ['drenaje-linfatico-embarazadas'],
    'tratamientos-faciales': ['tratamientos-faciales-para-uno', 'tratamientos-faciales-para-dos', 'tratamientos-faciales-sin-aparatologia', 'limpieza-facial'],
    'tratamientos-faciales-para-uno': ['tratamientos-faciales-para-uno'], 'tratamientos-faciales-para-dos': ['tratamientos-faciales-para-dos'],
    'tratamientos-faciales-sin-aparatologia': ['tratamientos-faciales-sin-aparatologia'], 'limpieza-facial': ['limpieza-facial'],
    'spa-day': ['spa-day'], 'spa-day-para-uno': ['spa-day-para-uno'], 'spa-day-para-dos': ['spa-day-para-dos'],
    'productos': ['skincare', 'bienestar', 'packs'], 'skin-care': ['skincare'], 'bienestar': ['bienestar'], 'pack': ['packs'],
    'convenios-empresas': ['convenios'], 'promociones-spa-mandala': ['promociones'], 'promociones-cyber-day': ['promociones'],
    'cyberday-2026': ['promociones'], 'promociones-navidad': ['promociones'], 'promociones-dia-de-la-madre': ['promociones'],
    'promociones-dia-del-padre': ['dia-del-padre'], 'regalos': ['spa-day'],
}
# Ya existen en el sitio nuevo o son pantallas de WooCommerce/duplicados: no se generan.
EXCLUIR = {'inicio', 'spa-mandala-inicio', 'my-account', 'checkout', 'cart', 'shop', 'track-order', 'lista-de-deseos',
           'mandala-store', 'productos-2', 'saldo-de-la-tarjeta-regalo', 'tarjeta-de-regalo', 'blog', 'promociones',
           'politicas-de-la-empresa', 'politicas-de-privacidad', 'sobre-nosotras', 'agenda-online'}
RUIDO = re.compile(r'añadir al carrito|ver carrito|seleccionar opciones|leer más|^\$|^\d+$|^precio|valoraci', re.I)


class Texto(HTMLParser):
    BLOQUES = {'h1': 'h2', 'h2': 'h2', 'h3': 'h3', 'h4': 'h3', 'p': 'p', 'li': 'li'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.tag, self.buf, self.href = [], None, [], None

    def handle_starttag(self, t, a):
        if t in self.BLOQUES:
            self.flush()
            self.tag = self.BLOQUES[t]
        elif t == 'a':
            h = dict(a).get('href') or ''
            m = re.match(r'https?://(?:www\.)?spamandala\.cl(/[^"#?]*)', h)
            self.href = m.group(1) if m else (h if h.startswith('/') else None)
            if self.href:
                self.buf.append(f'<a href="{html.escape(self.href)}">')
        elif t == 'br':
            self.buf.append(' ')

    def handle_endtag(self, t):
        if t == 'a' and self.href:
            self.buf.append('</a>')
            self.href = None
        elif self.BLOQUES.get(t) == self.tag:
            self.flush()

    def handle_data(self, d):
        if self.tag:
            self.buf.append(html.escape(d))

    def flush(self):
        s = re.sub(r'\s+', ' ', ''.join(self.buf)).strip()
        plano = re.sub(r'<[^>]+>', '', s)
        if self.tag and plano and not RUIDO.search(plano) and len(plano) > 2:
            if s.count('<a ') != s.count('</a>'):
                s = re.sub(r'</?a[^>]*>', '', s)
            self.out.append((self.tag, s))
        self.tag, self.buf = None, []


def bloques_html(contenido):
    p = Texto()
    p.feed(contenido)
    p.flush()
    vistos, out, lista = set(), [], False
    for tag, s in p.out:
        if s in vistos:  # Elementor repite bloques (versión móvil y escritorio)
            continue
        vistos.add(s)
        if tag == 'li' and not lista:
            out.append('<ul>')
            lista = True
        if tag != 'li' and lista:
            out.append('</ul>')
            lista = False
        out.append(f'<{tag}>{s}</{tag}>')
    if lista:
        out.append('</ul>')
    return '\n'.join(out)


def main(wxr, salida, salida_entradas):
    x = open(wxr, encoding='utf-8').read()
    g = lambda it, t: (re.search(rf'<{t}>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{t}>', it, re.S) or [0, ''])[1]
    meta = lambda it, k: (re.search(rf'<wp:meta_key><!\[CDATA\[{k}\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]>', it, re.S) or [0, ''])[1]
    pages, entradas = {}, []
    for it in re.findall(r'<item>(.*?)</item>', x, re.S):
        if '<wp:post_type><![CDATA[page]]>' in it and '<wp:status><![CDATA[publish]]>' in it:
            pages[g(it, 'wp:post_id')] = it
        if '<wp:post_type><![CDATA[post]]>' in it and '<wp:status><![CDATA[publish]]>' in it:
            entradas.append(g(it, 'wp:post_name'))

    def ruta(pid):
        it = pages[pid]
        par = g(it, 'wp:post_parent')
        return (ruta(par) if par in pages else '') + '/' + g(it, 'wp:post_name')

    out = []
    for pid, it in pages.items():
        slug = g(it, 'wp:post_name')
        if slug in EXCLUIR:
            continue
        out.append({
            'path': ruta(pid).strip('/'),
            'title': html.unescape(g(it, 'title')),
            'description': html.unescape(meta(it, '_yoast_wpseo_metadesc')),
            'categories': CATEGORIAS.get(slug, []),
            'html': bloques_html(html.unescape(g(it, 'content:encoded'))),
        })
    paths = [p['path'] for p in out]
    assert len(paths) == len(set(paths)), 'rutas duplicadas'
    json.dump(sorted(out, key=lambda p: p['path']), open(salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(sorted(entradas), open(salida_entradas, 'w', encoding='utf-8'), indent=1)
    print(len(out), 'páginas,', len(entradas), 'entradas')


if __name__ == '__main__':
    main(*sys.argv[1:4])
