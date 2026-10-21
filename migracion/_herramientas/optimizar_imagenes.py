# Convierte a WebP (1200 px de ancho máx., calidad 80) las imágenes principales pesadas del catálogo.
# Paso 1:  python optimizar_imagenes.py convertir <imagenes-pesadas.json> <carpeta_salida>
# Paso 2:  python optimizar_imagenes.py subir <astro-frontend/.env> <imagenes-pesadas.json> <carpeta_salida>
#          (sube cada WebP a Medios con el usuario WP_MEDIA_APP_USER y lo asigna como imagen principal;
#           la imagen anterior queda en Medios para poder revertir)
import base64, io, json, os, sys, urllib.parse, urllib.request
from PIL import Image

ANCHO, CALIDAD = 1200, 80

def convertir(lista, salida):
    os.makedirs(salida, exist_ok=True)
    for it in json.load(open(lista, encoding='utf8')):
        dest = os.path.join(salida, f"{it['slug']}.webp")
        if os.path.exists(dest): continue
        raw = urllib.request.urlopen(urllib.request.Request(it['src'], headers={'User-Agent': 'mandala-migracion'}), timeout=120).read()
        im = Image.open(io.BytesIO(raw))
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if im.width > ANCHO: im = im.resize((ANCHO, round(im.height * ANCHO / im.width)), Image.LANCZOS)
        im.save(dest, 'WEBP', quality=CALIDAD, method=6)
        print(f"{len(raw)//1024:>6} KB -> {os.path.getsize(dest)//1024:>4} KB  {it['slug']}")

def subir(envf, lista, salida):
    env = dict(l.strip().split('=', 1) for l in open(envf, encoding='utf8') if '=' in l and not l.startswith('#'))
    q = lambda k: env[k].strip().strip('"')
    o = urllib.parse.urlsplit(q('PUBLIC_WPGRAPHQL_URL'))
    root = f'{o.scheme}://{o.netloc}/index.php?rest_route='
    wp = 'Basic ' + base64.b64encode(f"{q('WP_MEDIA_APP_USER')}:{q('WP_MEDIA_APP_PASSWORD')}".encode()).decode()
    wc = 'Basic ' + base64.b64encode(f"{q('WC_REST_KEY')}:{q('WC_REST_SECRET')}".encode()).decode()
    def call(url, auth, data=None, method='GET', headers=None):
        h = {'Authorization': auth, 'User-Agent': 'mandala-migracion', **(headers or {})}
        return json.load(urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=h), timeout=120))
    hechos = []
    for it in json.load(open(lista, encoding='utf8')):
        archivo = it.get('archivo', it['slug'])  # nombre distinto si el original ya se llamaba <slug>.webp
        f = os.path.join(salida, f"{archivo}.webp")
        prod = call(f"{root}/wc/v3/products/{it['id'] if 'id' in it else ''}" if 'id' in it else f"{root}/wc/v3/products&slug={it['slug']}", wc)
        prod = prod[0] if isinstance(prod, list) else prod
        if not prod['images'] or prod['images'][0]['id'] != it['media']:
            print('omitido (la imagen ya cambió):', it['slug']); continue
        alt = prod['images'][0].get('alt') or prod['name']
        # Reusa una subida previa del mismo archivo (si un intento anterior se cortó) para no duplicar en Medios.
        previa = [m for m in call(f"{root}/wp/v2/media&search={it['slug']}&per_page=20", wp) if m['source_url'].endswith(f"/{archivo}.webp")]
        media = previa[0] if previa else call(f"{root}/wp/v2/media", wp, open(f, 'rb').read(), 'POST',
                     {'Content-Type': 'image/webp', 'Content-Disposition': f'attachment; filename="{archivo}.webp"'})
        # El usuario de subidas no puede editar adjuntos; el texto alternativo y el título los fija WooCommerce.
        imgs = [{'id': media['id'], 'alt': alt, 'name': prod['name']}] + [{'id': i['id']} for i in prod['images'][1:]]
        call(f"{root}/wc/v3/products/{prod['id']}", wc, json.dumps({'images': imgs}).encode(), 'PUT', {'Content-Type': 'application/json'})
        hechos.append({'producto': prod['id'], 'slug': it['slug'], 'anterior': it['media'], 'nueva': media['id']})
        print(f"ok {it['slug']}: #{it['media']} -> #{media['id']}")
    json.dump(hechos, open(os.path.join(salida, 'reemplazos.json'), 'w', encoding='utf8'), indent=1)

def catalogo(envf, lista, salida):
    """Convierte a WebP cada imagen de producto (principal y galería) de la lista {media, src, usos:[[producto, posición]]}
    y la reemplaza en todos los productos que la usan, conservando orden y texto alternativo."""
    env = dict(l.strip().split('=', 1) for l in open(envf, encoding='utf8') if '=' in l and not l.startswith('#'))
    q = lambda k: env[k].strip().strip('"')
    o = urllib.parse.urlsplit(q('PUBLIC_WPGRAPHQL_URL'))
    root = f'{o.scheme}://{o.netloc}/index.php?rest_route='
    wp = 'Basic ' + base64.b64encode(f"{q('WP_MEDIA_APP_USER')}:{q('WP_MEDIA_APP_PASSWORD')}".encode()).decode()
    wc = 'Basic ' + base64.b64encode(f"{q('WC_REST_KEY')}:{q('WC_REST_SECRET')}".encode()).decode()
    def call(url, auth, data=None, method='GET', headers=None):
        h = {'Authorization': auth, 'User-Agent': 'mandala-migracion', **(headers or {})}
        return json.load(urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=h), timeout=120))
    os.makedirs(salida, exist_ok=True)
    reg_path = os.path.join(salida, 'reemplazos-catalogo.json')
    hechos = json.load(open(reg_path, encoding='utf8')) if os.path.exists(reg_path) else {}
    nuevo = {int(k): v['nueva'] for k, v in hechos.items()}
    productos = set()
    for it in json.load(open(lista, encoding='utf8')):
        productos.update(u[0] for u in it['usos'])
        if it['media'] in nuevo: continue
        # Sufijo -opt: el nombre nunca choca con un original que ya fuera <nombre>.webp.
        nombre = os.path.splitext(os.path.basename(urllib.parse.urlsplit(it['src']).path))[0] + '-opt'
        f = os.path.join(salida, nombre + '.webp')
        kb_antes = None
        if not os.path.exists(f):
            raw = urllib.request.urlopen(urllib.request.Request(it['src'], headers={'User-Agent': 'mandala-migracion'}), timeout=120).read()
            im = Image.open(io.BytesIO(raw))
            im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
            if im.width > ANCHO: im = im.resize((ANCHO, round(im.height * ANCHO / im.width)), Image.LANCZOS)
            im.save(f, 'WEBP', quality=CALIDAD, method=6)
            kb_antes = len(raw) // 1024
        media = call(f"{root}/wp/v2/media", wp, open(f, 'rb').read(), 'POST',
                     {'Content-Type': 'image/webp', 'Content-Disposition': f'attachment; filename="{nombre}.webp"'})
        nuevo[it['media']] = media['id']
        hechos[str(it['media'])] = {'nueva': media['id'], 'src': it['src'], 'kb_antes': kb_antes, 'kb_despues': os.path.getsize(f) // 1024}
        json.dump(hechos, open(reg_path, 'w', encoding='utf8'), indent=1)  # registro tras cada subida: se puede retomar
        print(f"subida #{it['media']} -> #{media['id']}  {nombre}.webp ({os.path.getsize(f)//1024} KB)")
    for pid in sorted(productos):
        prod = call(f"{root}/wc/v3/products/{pid}", wc)
        if not any(i['id'] in nuevo for i in prod['images']): continue
        imgs = [{'id': nuevo[i['id']], 'alt': i.get('alt') or prod['name'], 'name': i.get('name') or prod['name']} if i['id'] in nuevo else {'id': i['id']} for i in prod['images']]
        call(f"{root}/wc/v3/products/{pid}", wc, json.dumps({'images': imgs}).encode(), 'PUT', {'Content-Type': 'application/json'})
        print(f"producto {prod['slug']}: {sum(1 for i in prod['images'] if i['id'] in nuevo)} imagen(es) reemplazada(s)")

if __name__ == '__main__':
    modo = sys.argv[1]
    if modo == 'convertir': convertir(*sys.argv[2:4])
    elif modo == 'catalogo': catalogo(*sys.argv[2:5])
    else: subir(*sys.argv[2:5])
