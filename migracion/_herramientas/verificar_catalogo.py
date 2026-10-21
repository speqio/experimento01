# Compara el catálogo de cms.spamandala.cl con el CSV de productos de producción: precios, ofertas,
# tipo (físico/virtual), complementos (upsells) y si se puede regalar como gift card.
# Uso: python verificar_catalogo.py <astro-frontend/.env> <productos.csv de producción> <salida.csv>
import base64, csv, json, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

env = dict(l.strip().split('=', 1) for l in open(sys.argv[1], encoding='utf8') if '=' in l and not l.startswith('#'))
o = urllib.parse.urlsplit(env['PUBLIC_WPGRAPHQL_URL'].strip('"'))
BASE = f'{o.scheme}://{o.netloc}/index.php?rest_route=/wc/v3/products'
AUTH = 'Basic ' + base64.b64encode(f"{env['WC_REST_KEY'].strip(chr(34))}:{env['WC_REST_SECRET'].strip(chr(34))}".encode()).decode()

def get(url):
    req = urllib.request.Request(url, headers={'Authorization': AUTH, 'User-Agent': 'mandala-migracion'})
    return json.load(urllib.request.urlopen(req, timeout=90))

def paginar(url):
    out, page = [], 1
    while True:
        r = get(f'{url}&per_page=100&page={page}')
        out += r
        if len(r) < 100: return out
        page += 1

norm = lambda s: ' '.join(str(s or '').lower().split())
precio = lambda v: str(int(float(v))) if str(v or '').strip() not in ('',) else ''

# Producción: padres por nombre; variaciones por (nombre del padre, valor del atributo 1).
prod = list(csv.DictReader(open(sys.argv[2], encoding='utf-8-sig')))
por_id = {r['ID']: r for r in prod}
padres = {norm(r['Nombre']): r for r in prod if not r['Tipo'].startswith('variation') and r['Publicado'] == '1'}
variaciones = {}
for r in prod:
    if r['Tipo'].startswith('variation'):
        sup = r['Superior'].replace('id:', '')
        p = por_id.get(sup) or next((x for x in prod if x['SKU'] == sup), None)
        if p: variaciones[(norm(p['Nombre']), frozenset(norm(v) for k, v in r.items() if k.startswith('Valor(es) del atributo') and v))] = r

cms = paginar(BASE + '&status=publish')
def con_variaciones(p):
    p['_vars'] = paginar(f"{BASE}/{p['id']}/variations&") if p['type'] == 'variable' else []
    return p
with ThreadPoolExecutor(6) as ex:
    cms = list(ex.map(con_variaciones, cms))

filas = []
def fila(nombre, tipo, c, pr, nota=''):
    obs = []
    if pr is None:
        obs.append('sin par exacto en producción (atributos distintos)')
    else:
        if precio(c['regular_price']) != precio(pr['Precio normal']): obs.append(f"precio {precio(c['regular_price'])} vs {precio(pr['Precio normal'])}")
        if precio(c['sale_price']) != precio(pr['Precio rebajado']): obs.append(f"oferta {precio(c['sale_price']) or '-'} vs {precio(pr['Precio rebajado']) or '-'}")
        if c.get('virtual') != ('virtual' in pr['Tipo']): obs.append('físico/virtual distinto')
    filas.append({'producto': nombre, 'tipo': tipo, 'precio_cms': precio(c['regular_price']), 'oferta_cms': precio(c['sale_price']),
                  'precio_prod': precio(pr['Precio normal']) if pr else '', 'oferta_prod': precio(pr['Precio rebajado']) if pr else '',
                  'fisico': 'no' if c.get('virtual') else 'sí', 'nota': nota, 'estado': 'ok' if not obs else 'revisar', 'observacion': '; '.join(obs)})

for p in cms:
    meta = {m['key']: m['value'] for m in p['meta_data']}
    es_upsell = bool(meta.get('productos_principales_ids'))
    regalable = meta.get('_mandala_gift_enabled') != 'no'
    nota = ', '.join(x for x in ['complemento' if es_upsell else '', 'regalable' if regalable and not es_upsell else ''] if x)
    pr = padres.get(norm(p['name']))
    if p['type'] == 'variable':
        for v in p['_vars']:
            attr = ' / '.join(a['option'] for a in v['attributes'])
            vp = variaciones.get((norm(p['name']), frozenset(norm(a['option']) for a in v['attributes'])))
            v['virtual'] = v.get('virtual')
            fila(f"{p['name']} — {attr}", 'variación', v, vp, nota)
    else:
        fila(p['name'], 'complemento' if es_upsell else p['type'], p, pr, nota)

with open(sys.argv[3], 'w', newline='', encoding='utf8') as f:
    w = csv.DictWriter(f, list(filas[0])); w.writeheader(); w.writerows(filas)
rev = [f for f in filas if f['estado'] != 'ok']
print(f"{len(filas)} filas ({len(cms)} productos), {len(rev)} por revisar")
for f in rev[:40]: print(' -', f['producto'][:70], '|', f['observacion'])
