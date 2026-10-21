# Mide con la API de PageSpeed Insights las páginas con más clics en Search Console, en producción y en laboratorio.
# Uso: python pagespeed.py <.env> <Páginas.csv de GSC> <salida.csv> [n_paginas]
import csv, json, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

env = dict(l.strip().split('=', 1) for l in open(sys.argv[1], encoding='utf8') if '=' in l and not l.startswith('#'))
KEY = env['PAGESPEED_API_KEY'].strip().strip('"')
n = int(sys.argv[4]) if len(sys.argv) > 4 else 25
SITIOS = {'produccion': 'https://spamandala.cl', 'laboratorio': 'https://laboratorio.space'}

rutas = ['/', '/contacto/', '/tienda/']
for r in csv.DictReader(open(sys.argv[2], encoding='utf8')):
    u = urllib.parse.urlsplit(r['Páginas principales'])
    if u.netloc == 'spamandala.cl' and not u.query and u.path not in rutas:
        rutas.append(u.path)
rutas = rutas[:n]

def medir(tarea):
    sitio, ruta, estrategia = tarea
    q = urllib.parse.urlencode({'url': SITIOS[sitio] + ruta, 'strategy': estrategia, 'category': 'performance', 'key': KEY})
    fila = {'sitio': sitio, 'ruta': ruta, 'dispositivo': estrategia}
    for intento in range(2):
        try:
            d = json.load(urllib.request.urlopen('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + q, timeout=180))
            a = d['lighthouseResult']['audits']
            fila.update(puntaje=round(d['lighthouseResult']['categories']['performance']['score'] * 100),
                        lcp_s=round(a['largest-contentful-paint']['numericValue'] / 1000, 2),
                        cls=round(a['cumulative-layout-shift']['numericValue'], 3),
                        tbt_ms=round(a['total-blocking-time']['numericValue']),
                        fcp_s=round(a['first-contentful-paint']['numericValue'] / 1000, 2), error='')
            return fila
        except Exception as e:
            fila['error'] = str(e)[:120]
    return fila

tareas = [(s, r, e) for r in rutas for s in SITIOS for e in ('mobile', 'desktop')]
with ThreadPoolExecutor(6) as ex:
    filas = list(ex.map(medir, tareas))
campos = ['sitio', 'ruta', 'dispositivo', 'puntaje', 'lcp_s', 'cls', 'tbt_ms', 'fcp_s', 'error']
with open(sys.argv[3], 'w', newline='', encoding='utf8') as f:
    w = csv.DictWriter(f, campos); w.writeheader(); w.writerows(filas)
print(f'{len(filas)} mediciones, {sum(1 for f in filas if f["error"])} con error')
