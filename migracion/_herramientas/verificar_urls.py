"""Recorre las URLs de spamandala.cl contra el sitio nuevo: cada una debe dar 200, o un solo 301 a una página que da 200.

Uso: python -I migracion/_herramientas/verificar_urls.py <base, p. ej. https://laboratorio.space>
Salida: 12-verificacion/urls.csv con el resultado por URL, y un resumen por pantalla.
"""
import csv, sys, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from redirecciones import IGNORAR, MIG, norm  # noqa: E402


class SinRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


abrir = urllib.request.build_opener(SinRedirect).open


def estado(url):
    try:
        r = abrir(urllib.request.Request(url, headers={'User-Agent': 'MandalaVerificador/1.0'}), timeout=60)
        return r.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Location')
    except Exception as e:
        return 0, str(e)


def revisar(base, p):
    s1, loc = estado(f'{base}/{p}/' if p else base + '/')
    if s1 == 200:
        return p, s1, '', '', 'ok'
    if s1 in (301, 308) and loc:
        destino = loc if loc.startswith('http') else base + loc
        s2, _ = estado(destino)
        return p, s1, destino.replace(base, ''), s2, 'ok' if s2 == 200 else 'destino roto'
    return p, s1, loc or '', '', 'falla'


def main(base):
    base = base.rstrip('/')
    clics = {norm(r['Páginas principales']): int(r['Clics'] or 0)
             for r in csv.DictReader(open(MIG / '01-inventario/gsc.csv', encoding='utf-8-sig'))}
    urls = sorted({norm(r['url']) for r in csv.DictReader(open(MIG / '01-inventario/urls.csv', encoding='utf-8-sig'))}
                  | {norm(r['Origen']) for r in csv.DictReader(open(MIG / '04-redirecciones/_crudo/yoast.csv', encoding='utf-8-sig'))})
    urls = [u for u in urls if not IGNORAR.search(u)]
    with ThreadPoolExecutor(6) as ex:
        res = list(ex.map(lambda p: revisar(base, p), urls))
    out = MIG / '12-verificacion/urls.csv'
    out.parent.mkdir(exist_ok=True)
    with open(out, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['url', 'estado', 'destino', 'estado_destino', 'resultado', 'clics'])
        for r in res:
            w.writerow([*r, clics.get(r[0], 0)])
    ok = [r for r in res if r[4] == 'ok']
    mal = sorted((r for r in res if r[4] != 'ok'), key=lambda r: -clics.get(r[0], 0))
    total = sum(clics.get(r[0], 0) for r in res) or 1
    print(f'{len(res)} URLs: {sum(r[1] == 200 for r in ok)} iguales (200), {sum(r[1] != 200 for r in ok)} con una 301, {len(mal)} con problema')
    print(f'clics cubiertos: {sum(clics.get(r[0], 0) for r in ok) * 100 / total:.1f} %')
    for r in mal[:30]:
        print('  ', clics.get(r[0], 0), r)


if __name__ == '__main__':
    main(sys.argv[1])
