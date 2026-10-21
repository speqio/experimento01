#!/usr/bin/env python3
"""Rastreador propio de solo lectura (reemplaza Screaming Frog, sin licencia).

Navega con un Chromium real (Playwright) en vez de requests HTTP directos, porque el
hosting corta la conexión a clientes sin huella de navegador real.

Recorre el sitio desde --inicio y desde los sitemaps, usando además las URLs de
--semillas (uno o más CSV con columna "url") como puntos de partida. Respeta
robots.txt y espera entre peticiones.

Uso:
    python rastrear.py --inicio https://spamandala.cl/ \
        --semillas ../01-inventario/urls_wp.csv --semillas ../01-inventario/gsc.csv \
        --salida ../01-inventario/rastreo.csv
"""
import argparse
import csv
import re
import sys
import urllib.parse
import urllib.robotparser
from collections import deque

from bs4 import BeautifulSoup

from navegador import Navegador, USER_AGENT


def mismo_dominio(url, base_netloc):
    try:
        return urllib.parse.urlparse(url).netloc == base_netloc
    except ValueError:
        return False


ASSET_EXT = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pdf", ".zip",
             ".css", ".js", ".woff", ".woff2", ".ttf", ".ico", ".mp4", ".xml")

ARCHIVO_FECHA_RE = re.compile(r"^/\d{4}(/\d{2}(/\d{2})?)?/?$")  # /2024/, /2024/10/, /2024/10/17/
PAGINACION_RE = re.compile(r"/(?:page/)?(\d+)/?$")
MAX_PAGINA = 5  # paginación de contenido real rara vez pasa de unas pocas páginas; más allá es trampa


def normalizar(url, base):
    url = urllib.parse.urljoin(base, url)
    url, _ = urllib.parse.urldefrag(url)
    partes = urllib.parse.urlsplit(url)
    url = urllib.parse.urlunsplit(("https",) + partes[1:])  # http y https son la misma página
    return url


def es_enlace_de_contenido(url):
    """Filtra trampas de rastreo: acciones de WooCommerce (add-to-cart, wishlist, gift
    card), archivos de fecha de WordPress (calendario, no contenido real) y paginación
    sin tope — todas generan una cantidad de URLs sin límite real."""
    path = urllib.parse.urlparse(url).path.lower()
    if path.endswith(ASSET_EXT):
        return False
    if ARCHIVO_FECHA_RE.match(path):
        return False
    m = PAGINACION_RE.search(path)
    if m and int(m.group(1)) > MAX_PAGINA:
        return False
    query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    acciones = ("add-to-cart", "remove_item", "undo_item", "add_to_wishlist",
                "yith-gift-this-product-form", "wc-ajax")
    return not any(p in query for p in acciones)


def leer_semillas(paths):
    urls = set()
    for p in paths:
        try:
            with open(p, newline="", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    for key in ("url", "URL", "Páginas principales", "Pagina", "Page"):
                        if key in row and row[key]:
                            urls.add(row[key].strip())
                            break
        except FileNotFoundError:
            print(f"aviso: semilla no encontrada: {p}", file=sys.stderr)
    return urls


def robots_de(nav, sitio):
    rp = urllib.robotparser.RobotFileParser()
    status, texto, _, _ = nav.obtener(f"{sitio}/robots.txt")
    if status == 200 and texto:
        rp.parse(texto.splitlines())
    else:
        print("aviso: no se pudo leer robots.txt, se continúa sin restricciones de él", file=sys.stderr)
        rp.allow_all = True
    return rp


def sitemaps_de(nav, sitio, extra=()):
    """Lee el índice de sitemaps y cada sub-sitemap.

    Yoast sirve el XML con una hoja XSL que un navegador real transforma en una tabla
    HTML — Chromium devuelve esa versión ya transformada (no el XML con <loc> crudo),
    así que se leen los <a href> de la tabla en vez de parsear XML.
    """
    sitio_netloc = urllib.parse.urlparse(sitio).netloc
    urls = set()
    vistos = set()
    cola = deque([f"{sitio}/sitemap_index.xml", f"{sitio}/sitemap.xml", *extra])
    while cola:
        sm = cola.popleft()
        if sm in vistos:
            continue
        vistos.add(sm)
        status, texto, _, _ = nav.obtener(sm)
        if status != 200 or not texto:
            continue
        soup = BeautifulSoup(texto, "html.parser")
        enlaces = [a["href"] for a in soup.find_all("a", href=True)]
        if not enlaces:
            # por si el sitio no usa Yoast y sí entrega XML crudo con <loc>
            soup_xml = BeautifulSoup(texto, "xml")
            enlaces = [loc.text.strip() for loc in soup_xml.find_all("loc")]
        for u in enlaces:
            if urllib.parse.urlparse(u).netloc != sitio_netloc:
                continue  # descarta links de la plantilla del sitemap (sitemaps.org, yoa.st, ...)
            if u.endswith(".xml") and "sitemap" in u:
                cola.append(u)
            else:
                urls.add(u)
    return urls, sorted(vistos)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--inicio", required=True)
    ap.add_argument("--sitemap", action="append", default=[],
                     help="URL de sitemap_index.xml u otro sitemap a usar además de la autodetección")
    ap.add_argument("--semillas", action="append", default=[])
    ap.add_argument("--salida", required=True)
    ap.add_argument("--max-paginas", type=int, default=5000)
    args = ap.parse_args()

    base = args.inicio
    base_netloc = urllib.parse.urlparse(base).netloc
    sitio = f"{urllib.parse.urlparse(base).scheme}://{base_netloc}"

    nav = Navegador()
    try:
        rp = robots_de(nav, sitio)

        sitemap_urls, sitemaps_vistos = sitemaps_de(nav, sitio, extra=args.sitemap)
        print(f"{len(sitemap_urls)} URLs en sitemaps ({len(sitemaps_vistos)} archivos)")

        semillas = leer_semillas(args.semillas)
        print(f"{len(semillas)} URLs de semillas (WordPress/Search Console)")

        cola = deque([base, *sitemap_urls, *semillas])
        vistos = set()
        filas = []
        imagenes = []

        while cola and len(vistos) < args.max_paginas:
            url = normalizar(cola.popleft(), base)
            if url in vistos or not mismo_dominio(url, base_netloc):
                continue
            vistos.add(url)

            if not rp.can_fetch(USER_AGENT, url):
                filas.append({"url": url, "status_code": "", "title": "", "meta_description": "",
                              "h1": "", "canonical": "", "nota": "bloqueado por robots.txt"})
                continue

            status, texto, content_type, url_final = nav.obtener(url)

            fila = {"url": url, "status_code": status or "error", "title": "", "meta_description": "",
                    "h1": "", "canonical": "", "nota": ""}

            if status is None:
                fila["nota"] = f"error de navegación: {url_final}"
            elif url_final.rstrip("/") != url.rstrip("/"):
                fila["nota"] = f"redirige a {url_final}"

            if status == 200 and "html" in content_type:
                soup = BeautifulSoup(texto, "html.parser")
                if soup.title:
                    fila["title"] = soup.title.text.strip()
                meta_desc = soup.find("meta", attrs={"name": "description"})
                if meta_desc:
                    fila["meta_description"] = meta_desc.get("content", "")
                h1 = soup.find("h1")
                if h1:
                    fila["h1"] = h1.get_text(strip=True)
                canon = soup.find("link", attrs={"rel": "canonical"})
                if canon:
                    fila["canonical"] = canon.get("href", "")

                for a in soup.find_all("a", href=True):
                    enlazada = normalizar(a["href"], url)
                    if (mismo_dominio(enlazada, base_netloc) and enlazada not in vistos
                            and es_enlace_de_contenido(enlazada)):
                        cola.append(enlazada)
                for img in soup.find_all("img"):
                    src = img.get("src")
                    if src:
                        imagenes.append({"pagina": url, "src": normalizar(src, url), "alt": img.get("alt", "")})

            filas.append(fila)
            if len(vistos) % 25 == 0:
                print(f"  {len(vistos)} páginas rastreadas, {len(cola)} en cola")
    finally:
        nav.cerrar()

    columnas = ["url", "status_code", "title", "meta_description", "h1", "canonical", "nota"]
    with open(args.salida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        w.writeheader()
        w.writerows(filas)
    print(f"\n{len(filas)} URLs escritas en {args.salida}")

    if imagenes:
        salida_img = args.salida.rsplit("/", 1)[0] + "/imagenes.csv"
        with open(salida_img, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["pagina", "src", "alt"])
            w.writeheader()
            w.writerows(imagenes)
        print(f"{len(imagenes)} imágenes escritas en {salida_img}")


if __name__ == "__main__":
    main()
