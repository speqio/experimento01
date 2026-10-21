"""Arma las redirecciones 301 de spamandala.cl hacia el sitio nuevo, sin cadenas.

Uso: python -I migracion/_herramientas/redirecciones.py
Entradas: inventario (01-inventario/urls.csv, gsc.csv), Yoast (04-redirecciones/_crudo/yoast.csv), WXR de producción,
páginas migradas (astro-frontend/src/data/*.json) y el catálogo vivo de cms.spamandala.cl (GraphQL, solo lectura).
Salidas: astro-frontend/src/data/redirecciones.json (lo lee src/middleware.ts) y 04-redirecciones/revisar.csv.
"""
import csv, html, json, re, unicodedata, urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
MIG = RAIZ / 'migracion'
DATA = RAIZ / 'astro-frontend' / 'src' / 'data'
GRAPHQL = 'https://cms.spamandala.cl/index.php?graphql'

FIJAS = {'', 'tienda', 'promociones', 'gift-cards', 'blog', 'agenda', 'sobre-nosotras', 'carrito',
         'politicas-de-la-empresa', 'politicas-de-privacidad'}
# Pantallas de WooCommerce y duplicados de la portada -> su equivalente en el sitio nuevo.
EQUIVALENTES = {
    'shop': 'tienda', 'mandala-store': 'tienda', 'productos-2': 'productos', 'cart': 'carrito', 'checkout': 'carrito',
    'my-account': '', 'track-order': '', 'lista-de-deseos': '', 'inicio': '', 'spa-mandala-inicio': '', 'home': '',
    'agenda-online': 'agenda', 'tarjeta-de-regalo': 'gift-cards', 'saldo-de-la-tarjeta-regalo': 'gift-cards',
    'gift-card': 'gift-cards', 'giftcard-category': 'gift-cards', 'regala-este-servicio': 'gift-cards',
}
# Páginas viejas sin equivalente exacto (revisadas a mano por clics de Search Console).
MANUALES = {
    'spa-day-mujeres': 'spa-day', 'spa-mix': 'spa-day', 'spa-day-pareja': 'spa-day/spa-day-para-dos',
    'promociones-2': 'promociones', 'promociones-2-2': 'promociones', 'promociones-spa-y-masajes': 'promociones',
    'masajes-para-dos': 'masajes/masaje-para-dos', 'masajes-desestresantes-embarazada': 'masajes/masaje-para-embarazadas',
    'spa-embarazadas': 'masajes/masaje-para-embarazadas', 'faciales-sin-aparatologia': 'tratamientos-faciales/tratamientos-faciales-sin-aparatologia',
    'faciales-para-dos': 'tratamientos-faciales/tratamientos-faciales-para-dos', 'limpieza-de-espalda': 'limpieza-de-espalda-spamandala',
    'spa-mandala': '', 'faciales-para-uno': 'tratamientos-faciales/tratamientos-faciales-para-uno',
    'faciales-mujeres': 'tratamientos-faciales', 'faciales-mujer': 'tratamientos-faciales', 'faciales-antiage': 'tratamientos-faciales',
    'drenaje-linfatico-embarazada': 'drenaje-linfatico-embarazadas', 'dinero-mandala-giftcard': 'gift-cards',
    'automasaje-attnuar-cintura': 'automasaje-para-atenuar-cintura',
    'causas-emocionales-del-dolor-de-espalda': 'dolor-de-espalda-y-su-significado-emocional',
}
IGNORAR = re.compile(r'^(wp-admin|wp-content|wp-includes|wp-json|wp-login\.php|xmlrpc\.php|feed|comments|author|cdn-cgi)(/|$)|\.xml$|/feed$|^\?')


def norm(u):
    """URL o ruta -> ruta sin dominio, query ni barras, decodificada y en minúsculas."""
    p = re.sub(r'^https?://[^/]+', '', u.strip()).split('?')[0].split('#')[0]
    return urllib.request.unquote(p).strip('/').lower()


def clave(s):
    return unicodedata.normalize('NFKD', html.unescape(s)).encode('ascii', 'ignore').decode().lower().strip()


def gql(query):
    req = urllib.request.Request(GRAPHQL, data=json.dumps({'query': query}).encode(),
                                 headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    return json.load(urllib.request.urlopen(req))['data']


def catalogo():
    prods, after = [], None
    while True:
        d = gql('{products(first:100%s){pageInfo{hasNextPage endCursor} nodes{slug name sku productCategories{nodes{slug}}}}}'
                % (f',after:"{after}"' if after else ''))['products']
        prods += d['nodes']
        if not d['pageInfo']['hasNextPage']:
            break
        after = d['pageInfo']['endCursor']
    d = gql('{productCategories(first:100){nodes{slug count parent{node{slug}}}} productTags(first:200){nodes{slug count}}}')
    cats = {c['slug']: (c['parent']['node']['slug'] + '/' if c['parent'] else '') + c['slug']
            for c in d['productCategories']['nodes'] if c['count']}
    tags = {t['slug'] for t in d['productTags']['nodes'] if t['count']}
    return prods, cats, tags


def wxr_productos():
    """Productos de producción (cualquier estado): slug -> (sku, nombre, categorías)."""
    x = (MIG / '02-contenido/_crudo/wxr/spamandala.WordPress.2026-10-21.xml').read_text(encoding='utf-8')
    out = {}
    for it in re.findall(r'<item>(.*?)</item>', x, re.S):
        if '<wp:post_type><![CDATA[product]]>' not in it:
            continue
        slug = re.search(r'<wp:post_name><!\[CDATA\[(.*?)\]\]>', it).group(1).lower()
        slug = re.sub(r'__trashed(-\d+)?$', '', slug)
        sku = re.search(r'_sku\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]>', it)
        nombre = re.search(r'<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', it, re.S).group(1)
        cats = re.findall(r'<category domain="product_cat" nicename="([^"]+)"', it)
        out.setdefault(slug, (sku.group(1) if sku else '', nombre, cats))
    return out


def main():
    paginas = {p['path'] for p in json.load(open(DATA / 'paginas-wp.json', encoding='utf-8'))}
    entradas = set(json.load(open(DATA / 'entradas-wp.json', encoding='utf-8')))
    prods, cats, tags = catalogo()
    vivos = {p['slug'] for p in prods}
    por_sku = {p['sku']: p['slug'] for p in prods if p.get('sku')}
    por_nombre = {clave(p['name']): p['slug'] for p in prods}
    cat_de = {p['slug']: [c['slug'] for c in p['productCategories']['nodes']] for p in prods}
    wxr = wxr_productos()
    ultimo = {}  # último segmento -> ruta servida (páginas y categorías), para URLs movidas de carpeta
    for p in paginas:
        ultimo.setdefault(p.split('/')[-1], p)
    for slug, ruta in cats.items():
        ultimo.setdefault(slug, 'categoria-producto/' + ruta)

    def servida(p):
        s = p.split('/')
        if p in FIJAS or p in paginas:
            return True
        if s[0] == 'producto':
            return len(s) == 2 and s[1] in vivos
        if s[0] == 'categoria-producto':
            return len(s) in (2, 3) and cats.get(s[-1]) == '/'.join(s[1:])
        if s[0] == 'etiqueta-producto':
            return len(s) == 2 and s[1] in tags
        if s[0] == 'blog':
            return len(s) == 2 and s[1] in entradas
        return bool(re.fullmatch(r'(\d{4}/\d{2}/\d{2}/)?([a-z0-9-]+)', p)) and s[-1] in entradas

    yoast = {}
    for r in csv.DictReader(open(MIG / '04-redirecciones/_crudo/yoast.csv', encoding='utf-8-sig')):
        yoast[norm(r['Origen'])] = norm(r['Destino'])

    def producto_destino(slug):
        if slug in vivos:
            return 'producto/' + slug
        sku, nombre, pcats = wxr.get(slug, ('', '', []))
        nuevo = por_sku.get(sku) or por_nombre.get(clave(nombre))
        if nuevo:
            return 'producto/' + nuevo
        for c in pcats:
            if c in cats:
                return 'categoria-producto/' + cats[c]
        return None

    def resolver(p, vistos=()):
        """Destino servido para p, siguiendo Yoast sin cadenas; None si no hay uno razonable."""
        if servida(p):
            return p
        if p in vistos or len(vistos) > 10:
            return None
        vistos = vistos + (p,)
        if p in yoast:
            d = resolver(yoast[p], vistos)
            if d is not None:
                return d
        s = p.split('/')
        if re.fullmatch(r'\d+', s[-1]) and len(s) > 1:  # paginación vieja: /shop/2
            return resolver('/'.join(s[:-1]), vistos)
        if s[0] in EQUIVALENTES:
            return EQUIVALENTES[s[0]]
        if s[-1] in MANUALES:
            return resolver(MANUALES[s[-1]], vistos)
        if s[0] == 'producto' and len(s) == 2:
            return producto_destino(s[1]) or 'tienda'
        if s[0] in ('categoria-producto', 'etiqueta-producto'):
            return ultimo.get(s[-1]) if s[-1] in ultimo else 'tienda'
        base = re.sub(r'(-spamandala)?(-\d+)?$', '', s[-1])  # copias viejas: limpieza-facial-spamandala, ...-2
        for k in (s[-1], base):
            if k in ultimo:
                return ultimo[k]
            if k in MANUALES:
                return resolver(MANUALES[k], vistos)
        return None

    clics = {}
    for r in csv.DictReader(open(MIG / '01-inventario/gsc.csv', encoding='utf-8-sig')):
        clics[norm(r['Páginas principales'])] = int(r['Clics'] or 0)
    origenes = set(yoast)
    for r in csv.DictReader(open(MIG / '01-inventario/urls.csv', encoding='utf-8-sig')):
        origenes.add(norm(r['url']))

    mapa, revisar = {}, []
    for p in sorted(origenes):
        if not p or IGNORAR.search(p) or servida(p):
            continue
        d = resolver(p)
        if d is None:
            revisar.append((clics.get(p, 0), p, yoast.get(p, '')))
        elif d != p:
            mapa['/' + p] = '/' + d + ('/' if d else '')

    # Ningún destino puede ser a su vez un origen (sin cadenas).
    assert not any(d.rstrip('/') in mapa for d in mapa.values() if d != '/'), 'quedó una cadena'
    json.dump(mapa, open(DATA / 'redirecciones.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    with open(MIG / '04-redirecciones/revisar.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['clics', 'url', 'destino_yoast'])
        w.writerows(sorted(revisar, reverse=True))
    print(len(mapa), 'redirecciones;', len(revisar), 'sin destino (ver revisar.csv)')


if __name__ == '__main__':
    main()
