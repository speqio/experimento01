# Compara el catálogo de cms.spamandala.cl con el CSV de productos de producción: precios, ofertas,
# tipo (físico/virtual), complementos (upsells) y si se puede regalar como gift card.
# Uso: python verificar_catalogo.py <astro-frontend/.env> <productos.csv de producción> <salida.csv> [--aplicar]
# Con --aplicar iguala en el CMS precio normal, oferta y fechas de oferta de las filas con par exacto en producción.
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
        if p: variaciones.setdefault((norm(p['Nombre']), frozenset(norm(v) for k, v in r.items() if k.startswith('Valor(es) del atributo') and v)), []).append(r)

cms = paginar(BASE + '&status=publish')
def con_variaciones(p):
    p['_vars'] = paginar(f"{BASE}/{p['id']}/variations&") if p['type'] == 'variable' else []
    return p
with ThreadPoolExecutor(6) as ex:
    cms = list(ex.map(con_variaciones, cms))

filas, correcciones = [], []
fecha = lambda v: str(v or '').strip().replace(' ', 'T')
def fila(nombre, tipo, c, pr, nota='', url=''):
    obs = []
    if pr is None:
        obs.append('sin par exacto en producción (atributos distintos)')
    else:
        if precio(c['regular_price']) != precio(pr['Precio normal']): obs.append(f"precio {precio(c['regular_price'])} vs {precio(pr['Precio normal'])}")
        if precio(c['sale_price']) != precio(pr['Precio rebajado']): obs.append(f"oferta {precio(c['sale_price']) or '-'} vs {precio(pr['Precio rebajado']) or '-'}")
        if c.get('virtual') != ('virtual' in pr['Tipo']): obs.append('físico/virtual distinto')
        if any(o.startswith(('precio', 'oferta')) for o in obs):
            correcciones.append((nombre, url, {'regular_price': precio(pr['Precio normal']), 'sale_price': precio(pr['Precio rebajado']),
                                               'date_on_sale_from': fecha(pr['Día en que empieza el precio rebajado']),
                                               'date_on_sale_to': fecha(pr['Día en que termina el precio rebajado'])}))
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
            grupo = variaciones.get((norm(p['name']), frozenset(norm(a['option']) for a in v['attributes'])), [])
            v['virtual'] = v.get('virtual')
            if len(grupo) > 1:
                # ponytail: atributos que no distinguen (p. ej. falta "Duración"): solo se comprueba que el precio exista en el grupo; nunca se corrige solo.
                par = next((g for g in grupo if precio(g['Precio normal']) == precio(v['regular_price']) and precio(g['Precio rebajado']) == precio(v['sale_price'])), None)
                filas.append({'producto': f"{p['name']} — {' / '.join(a['option'] for a in v['attributes'])}", 'tipo': 'variación',
                              'precio_cms': precio(v['regular_price']), 'oferta_cms': precio(v['sale_price']),
                              'precio_prod': precio(par['Precio normal']) if par else '', 'oferta_prod': precio(par['Precio rebajado']) if par else '',
                              'fisico': 'no' if v.get('virtual') else 'sí', 'nota': nota, 'estado': 'ok' if par else 'revisar',
                              'observacion': '' if par else 'variaciones con los mismos atributos; precio no está entre los de producción'})
                continue
            vp = grupo[0] if grupo else None
            fila(f"{p['name']} — {attr}", 'variación', v, vp, nota, f"{BASE}/{p['id']}/variations/{v['id']}")
    else:
        fila(p['name'], 'complemento' if es_upsell else p['type'], p, pr, nota, f"{BASE}/{p['id']}")

with open(sys.argv[3], 'w', newline='', encoding='utf8') as f:
    w = csv.DictWriter(f, list(filas[0])); w.writeheader(); w.writerows(filas)
rev = [f for f in filas if f['estado'] != 'ok']
print(f"{len(filas)} filas ({len(cms)} productos), {len(rev)} por revisar")
for f in rev[:40]: print(' -', f['producto'][:70], '|', f['observacion'])

if '--aplicar' in sys.argv:
    for nombre, url, datos in correcciones:
        req = urllib.request.Request(url, data=json.dumps(datos).encode(), method='PUT',
                                     headers={'Authorization': AUTH, 'Content-Type': 'application/json', 'User-Agent': 'mandala-migracion'})
        r = json.load(urllib.request.urlopen(req, timeout=90))
        ok = precio(r['regular_price']) == datos['regular_price'] and precio(r['sale_price']) == datos['sale_price']
        print(('corregido ' if ok else 'NO QUEDÓ  ') + nombre[:70], datos['regular_price'], datos['sale_price'] or '-')
else:
    print(f"{len(correcciones)} con precio u oferta por igualar (usa --aplicar)")
