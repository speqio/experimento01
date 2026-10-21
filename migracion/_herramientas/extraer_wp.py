#!/usr/bin/env python3
"""Extrae el inventario de URLs de un WordPress vía su REST API pública (solo lectura).

Navega con un Chromium real (Playwright) en vez de hacer requests HTTP directos, porque
el hosting corta la conexión a clientes sin huella de navegador.

Uso:
    python extraer_wp.py --sitio https://spamandala.cl --salida ../01-inventario
"""
import argparse
import csv
import json
import sys

from navegador import Navegador

PER_PAGE = 100


def tipos_publicos(nav, sitio):
    status, texto, _, _ = nav.obtener(f"{sitio}/wp-json/wp/v2/types")
    if status != 200:
        raise RuntimeError(f"/wp-json/wp/v2/types respondió {status}")
    data = json.loads(texto)
    tipos = []
    for t in data.values():
        rest_base = t.get("rest_base")
        if rest_base:
            tipos.append((t.get("slug", rest_base), rest_base))
    return tipos


def paginar(nav, sitio, rest_base):
    page = 1
    while True:
        url = f"{sitio}/wp-json/wp/v2/{rest_base}?per_page={PER_PAGE}&page={page}&status=publish"
        status, texto, _, _ = nav.obtener(url)
        if status == 400:
            break  # se pasó de la última página
        if status != 200:
            print(f"  aviso: {rest_base} página {page} respondió {status}", file=sys.stderr)
            break
        try:
            items = json.loads(texto)
        except json.JSONDecodeError:
            print(f"  aviso: {rest_base} página {page} no devolvió JSON válido", file=sys.stderr)
            break
        if not items:
            break
        yield from items
        if len(items) < PER_PAGE:
            break
        page += 1


def yoast_de(item):
    yh = item.get("yoast_head_json") or {}
    return {
        "yoast_title": yh.get("title", ""),
        "yoast_metadesc": yh.get("description", ""),
        "yoast_canonical": yh.get("canonical", ""),
        "yoast_noindex": "1" if (yh.get("robots", {}) or {}).get("index") == "noindex" else "",
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sitio", required=True, help="https://spamandala.cl (sin barra final)")
    ap.add_argument("--salida", required=True, help="carpeta 01-inventario donde escribir urls_wp.csv")
    args = ap.parse_args()
    sitio = args.sitio.rstrip("/")

    nav = Navegador()
    try:
        print(f"Tipos de contenido públicos en {sitio} ...")
        try:
            tipos = tipos_publicos(nav, sitio)
        except Exception as e:
            print(f"No se pudo leer /wp-json/wp/v2/types: {e}", file=sys.stderr)
            sys.exit(1)
        print(f"  {len(tipos)} tipos: {', '.join(t for t, _ in tipos)}")

        filas = []
        for slug, rest_base in tipos:
            print(f"Extrayendo {slug} ({rest_base}) ...")
            n = 0
            for item in paginar(nav, sitio, rest_base):
                link = item.get("link", "")
                title = (item.get("title", {}) or {}).get("rendered", "")
                fila = {
                    "tipo": slug,
                    "id": item.get("id", ""),
                    "url": link,
                    "slug_post": item.get("slug", ""),
                    "title": title,
                    "modified": item.get("modified", ""),
                    "status": item.get("status", ""),
                }
                fila.update(yoast_de(item))
                filas.append(fila)
                n += 1
            print(f"  {n} elementos")
    finally:
        nav.cerrar()

    if not filas:
        print("Sin resultados — revisar si el sitio expone la REST API.", file=sys.stderr)

    salida = f"{args.salida.rstrip('/')}/urls_wp.csv"
    columnas = ["tipo", "id", "url", "slug_post", "title", "modified", "status",
                "yoast_title", "yoast_metadesc", "yoast_canonical", "yoast_noindex"]
    with open(salida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        w.writeheader()
        w.writerows(filas)
    print(f"\n{len(filas)} URLs escritas en {salida}")


if __name__ == "__main__":
    main()
