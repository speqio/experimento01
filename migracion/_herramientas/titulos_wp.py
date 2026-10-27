"""Títulos <title> que servía producción, para que el sitio nuevo los repita y no pierda posicionamiento.

Uso: python -I migracion/_herramientas/titulos_wp.py
Entrada:
  migracion/01-inventario/rastreo.csv        rastreo de spamandala.cl (título ya resuelto por Yoast)
Salida:
  astro-frontend/src/data/titulos-wp.json    ruta -> título exacto de producción

Se omiten las URL con parámetros y las que producción servía con el título pelado "Spa Mandala"
(plantilla de Yoast sin rellenar): para esas rige la regla de respaldo de lib/seo.ts (`Nombre | Spa Mandala`).
"""
import csv, json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = 'https://spamandala.cl'


def main():
    titulos = {}
    with open(RAIZ / 'migracion/01-inventario/rastreo.csv', encoding='utf-8-sig', newline='') as f:
        for fila in csv.DictReader(f):
            url, titulo = fila['url'], fila['title'].strip()
            if fila['status_code'] != '200' or not titulo or titulo == 'Spa Mandala' or '?' in url:
                continue
            ruta = url.removeprefix(ORIGEN)
            clave = '/' if ruta in ('', '/') else '/' + ruta.strip('/').lower() + '/'
            titulos[clave] = titulo
    assert all('�' not in t for t in titulos.values()), 'rastreo.csv no está en UTF-8'
    salida = RAIZ / 'astro-frontend/src/data/titulos-wp.json'
    salida.write_text(json.dumps(titulos, ensure_ascii=False, indent=0, sort_keys=True) + '\n', encoding='utf-8')
    print(f'{len(titulos)} títulos -> {salida.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
