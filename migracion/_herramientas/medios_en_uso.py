"""Lista los archivos de wp-content/uploads de producción que el sitio nuevo realmente usa, sin conectarse al sitio.

Uso: python -I migracion/_herramientas/medios_en_uso.py
Fuentes: WXR (imagen destacada y contenido de las entradas del blog), Yoast (og:image por URL) y el CMS nuevo
(para no repetir lo que ya tiene). Salida: migracion/03-medios/medios-en-uso.txt (rutas relativas a uploads/)
y medios-en-uso.csv (archivo, para qué se usa, si ya está en el CMS).
"""
import csv, json, re, urllib.parse, urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
MIG = RAIZ / 'migracion'
WXR = MIG / '02-contenido/_crudo/wxr/spamandala.WordPress.2026-10-21.xml'
UPLOAD = re.compile(r'https?://(?:www\.)?spamandala\.cl/wp-content/uploads/([^"\'\s)<>?#\\]+?\.(?:jpe?g|png|webp|gif|svg|avif|mp4|pdf))', re.I)
TAMANO = re.compile(r'-\d+x\d+(?=\.\w+$)')  # miniatura de WordPress -> original (WP las vuelve a generar)
USADOS = ('product', 'page', 'post')


def original(rel):
    rel = urllib.parse.unquote(rel)
    return TAMANO.sub('', re.sub(r'-scaled(?=\.\w+$)', '', rel))


def main():
    x = WXR.read_text(encoding='utf-8')
    g = lambda it, t: (re.search(rf'<{t}>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{t}>', it, re.S) or [0, ''])[1]
    meta = lambda it, k: (re.search(rf'<wp:meta_key><!\[CDATA\[{k}\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]>', it, re.S) or [0, ''])[1]
    adjuntos, items = {}, []
    for it in re.findall(r'<item>(.*?)</item>', x, re.S):
        tipo = g(it, 'wp:post_type')
        if tipo == 'attachment':
            adjuntos[g(it, 'wp:post_id')] = meta(it, '_wp_attached_file')
        elif tipo in USADOS + ('product_variation',) and g(it, 'wp:status') == 'publish':
            items.append((tipo, g(it, 'wp:post_name'), it))

    uso = {}  # archivo -> set de usos
    def marcar(rel, motivo):
        if rel:
            # El archivo exacto (la URL que se usa) y su original, por si WordPress regenera tamaños.
            for f in {urllib.parse.unquote(rel), original(rel)}:
                uso.setdefault(f, set()).add(motivo)
    for tipo, slug, it in items:
        etiqueta = f'{tipo}:{slug}'
        # Solo entradas del blog: los productos del CMS ya tienen sus fotos y las páginas se migraron sin imágenes.
        if tipo == 'post':
            marcar(adjuntos.get(meta(it, '_thumbnail_id')), f'destacada {etiqueta}')
            for rel in UPLOAD.findall(g(it, 'content:encoded')):
                marcar(rel, f'contenido {etiqueta}')
    for r in csv.DictReader(open(MIG / '00-config/yoast-seo.csv', encoding='utf-8-sig')):
        for col in ('open_graph_image', 'twitter_image'):
            m = UPLOAD.search(r.get(col) or '')
            # Productos y entradas usan su propia imagen como og:image (ver lib/seo.ts); la de Yoast solo cuenta en el resto.
            if m and r.get('post_status') in (None, '', 'publish') and r.get('object_sub_type') not in ('product', 'post'):
                marcar(m.group(1), 'og:image ' + re.sub(r'^https?://[^/]+', '', r['permalink']))
    for linea in (MIG / '00-config/yoast-config.txt').read_text(encoding='utf-8').splitlines():
        m = UPLOAD.search(linea)
        if m and linea.split('=')[0].strip() in ('company_logo', 'og_default_image', 'person_logo'):
            marcar(m.group(1), 'logo/og por defecto (Yoast)')

    # Lo que el CMS nuevo ya tiene (los productos importados trajeron su imagen): mismo nombre de archivo.
    en_cms, pagina = set(), 1
    while True:
        req = urllib.request.Request(f'https://cms.spamandala.cl/index.php?rest_route=/wp/v2/media&per_page=100&page={pagina}&_fields=source_url',
                                     headers={'User-Agent': 'Mozilla/5.0'})
        try:
            lote = json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError:
            break
        if not lote:
            break
        en_cms |= {original(Path(urllib.parse.urlparse(m['source_url']).path).name) for m in lote}
        pagina += 1

    destino = MIG / '03-medios'
    destino.mkdir(exist_ok=True)
    faltan = sorted(r for r in uso if original(Path(r).name) not in en_cms)
    (destino / 'medios-en-uso.txt').write_text('\n'.join(faltan) + '\n', encoding='utf-8')
    with open(destino / 'medios-en-uso.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['archivo', 'ya_en_cms', 'usos'])
        for r in sorted(uso):
            w.writerow([r, 'sí' if original(Path(r).name) in en_cms else 'no', ' | '.join(sorted(uso[r]))])
    print(f'{len(adjuntos)} adjuntos en producción; {len(uso)} en uso; {len(uso) - len(faltan)} ya en el CMS; {len(faltan)} por migrar')


if __name__ == '__main__':
    main()
