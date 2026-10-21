"""Extrae del respaldo SQL de producción la tabla de Yoast (yoast_indexable): SEO por URL, sin conectarse al sitio.

Uso: python -I migracion/_herramientas/yoast_seo.py <respaldo.sql.zip>
Salidas:
  migracion/00-config/yoast-seo.csv         todas las filas públicas (sin autores/usuarios), para revisar
  astro-frontend/src/data/seo-wp.json       solo lo que el frontend usa: ruta -> canonical, noindex, og:image, miga
"""
import csv, io, json, re, sys, zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CAMPOS = ['permalink', 'object_type', 'object_sub_type', 'post_status', 'is_public', 'title', 'description',
          'breadcrumb_title', 'canonical', 'is_robots_noindex', 'is_robots_nofollow', 'open_graph_title',
          'open_graph_description', 'open_graph_image', 'twitter_image', 'schema_page_type', 'schema_article_type',
          'object_last_modified']


def valores(tupla):
    """Parte una fila SQL '(1, 'a\\'b', NULL, ...)' en valores de Python."""
    out, i, n = [], 1, len(tupla)
    while i < n:
        c = tupla[i]
        if c == "'":
            j, buf = i + 1, []
            while tupla[j] != "'":
                if tupla[j] == '\\':
                    j += 1
                    buf.append({'n': '\n', 'r': '\r', 't': '\t', '0': ''}.get(tupla[j], tupla[j]))
                else:
                    buf.append(tupla[j])
                j += 1
            out.append(''.join(buf))
            i = j + 1
        elif tupla.startswith('NULL', i):
            out.append(None)
            i += 4
        elif c in '-0123456789':
            m = re.match(r'-?[\d.]+', tupla[i:])
            out.append(m.group(0))
            i += len(m.group(0))
        else:
            i += 1  # coma, espacio o el ')' final
    return out


def ruta(url):
    return re.sub(r'^https?://[^/]+', '', url or '').split('?')[0].strip('/').lower()


def main(zip_path):
    z = zipfile.ZipFile(zip_path)
    cols, filas, en_tabla, en_insert = [], [], False, False
    with z.open(z.infolist()[0].filename) as f:
        for raw in io.TextIOWrapper(f, encoding='utf-8', errors='replace'):
            nombre = raw.split('`')[1] if raw.startswith(('CREATE TABLE `', 'INSERT INTO `')) else ''
            if raw.startswith('CREATE TABLE `') and nombre.endswith('_yoast_indexable'):
                en_tabla = True
                continue
            if en_tabla:
                m = re.match(r'\s+`(\w+)`', raw)
                if m:
                    cols.append(m.group(1))
                en_tabla = not raw.startswith(')')
            if raw.startswith('INSERT INTO `') and nombre.endswith('_yoast_indexable'):
                en_insert = True
                continue
            if en_insert and raw.startswith('('):
                fila = dict(zip(cols, valores(raw.rstrip().rstrip(',;'))))
                if fila.get('object_type') in ('post', 'term', 'home-page') and fila.get('permalink'):
                    filas.append(fila)
                en_insert = not raw.rstrip().endswith(';')
    assert cols and filas, 'no se encontró yoast_indexable en el respaldo'

    with open(RAIZ / 'migracion/00-config/yoast-seo.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, CAMPOS, extrasaction='ignore')
        w.writeheader()
        w.writerows(filas)

    seo = {}
    for r in filas:
        if r.get('post_status') not in (None, 'publish') or r['object_sub_type'] in ('attachment', 'nav_menu_item'):
            continue
        p = ruta(r['permalink'])
        e = {}
        if r.get('canonical') and ruta(r['canonical']) != p:
            e['canonical'] = '/' + ruta(r['canonical']) + '/'
        if r.get('is_robots_noindex') == '1':
            e['noindex'] = True
        img = r.get('open_graph_image') or r.get('twitter_image')
        if img and r.get('open_graph_image_source') != 'first-content-image':
            e['image'] = img
        if r.get('breadcrumb_title'):
            e['crumb'] = r['breadcrumb_title']
        if e:
            seo['/' + p + ('/' if p else '')] = e
    json.dump(seo, open(RAIZ / 'astro-frontend/src/data/seo-wp.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    print(len(filas), 'filas;', len(seo), 'rutas con datos;',
          sum('canonical' in e for e in seo.values()), 'canonical,', sum('noindex' in e for e in seo.values()), 'noindex,',
          sum('image' in e for e in seo.values()), 'og:image')


if __name__ == '__main__':
    main(sys.argv[1])
