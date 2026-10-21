#!/usr/bin/env python3
"""Cruza WordPress + rastreo + Search Console (+ redirecciones) en la lista maestra urls.csv.

Uso:
    python consolidar.py --wp ../01-inventario/urls_wp.csv --rastreo ../01-inventario/rastreo.csv \
        --gsc ../01-inventario/gsc.csv --redirecciones ../04-redirecciones/actuales.csv \
        --salida ../01-inventario
"""
import argparse
import csv


def leer(path, campo_url_alternativos=("url", "URL", "Páginas principales")):
    if not path:
        return {}
    out = {}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                url = None
                for campo in campo_url_alternativos:
                    if campo in row and row[campo]:
                        url = row[campo].strip()
                        break
                if url:
                    out[url.rstrip("/")] = row
    except FileNotFoundError:
        print(f"aviso: no encontrado, se omite: {path}")
    return out


def alertas_de(url, en_wp, en_rastreo, en_gsc, rastreo_row, redirige_desde, estado_gsc):
    alertas = []
    if en_gsc and not en_wp and not en_rastreo:
        alertas.append("solo en Search Console")
    if en_wp and not en_rastreo and not en_gsc:
        alertas.append("solo en WordPress / huérfana")
    if en_rastreo and not en_wp and not en_gsc:
        alertas.append("solo en rastreo")
    if estado_gsc and estado_gsc != "indexada":
        alertas.append(f"GSC: {estado_gsc}")
    if rastreo_row:
        try:
            code = int(rastreo_row.get("status_code") or 0)
            if code >= 400:
                alertas.append(f"responde {code}")
        except ValueError:
            pass
        if not rastreo_row.get("title"):
            alertas.append("sin title")
        if not rastreo_row.get("meta_description"):
            alertas.append("sin meta description")
        canon = rastreo_row.get("canonical")
        if canon and canon.rstrip("/") != url:
            alertas.append("canonical apunta a otra URL")
    if url in redirige_desde:
        alertas.append("tiene redirección definida")
    return "; ".join(alertas)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--wp")
    ap.add_argument("--rastreo")
    ap.add_argument("--gsc")
    ap.add_argument("--indexacion", help="CSV con columnas url,estado_gsc (indexada/error 404/bloqueada por robots/...)")
    ap.add_argument("--redirecciones")
    ap.add_argument("--salida", required=True)
    args = ap.parse_args()

    wp = leer(args.wp)
    rastreo = leer(args.rastreo)
    gsc = leer(args.gsc, campo_url_alternativos=("Páginas principales", "url", "URL"))
    redirecciones = leer(args.redirecciones, campo_url_alternativos=("origen",))
    indexacion = leer(args.indexacion, campo_url_alternativos=("url",))

    todas = set(wp) | set(rastreo) | set(gsc) | set(indexacion)

    filas = []
    for url in sorted(todas):
        en_wp = url in wp
        en_rastreo = url in rastreo
        en_gsc = url in gsc
        rastreo_row = rastreo.get(url, {})
        wp_row = wp.get(url, {})
        estado_gsc = indexacion.get(url, {}).get("estado_gsc", "")
        filas.append({
            "url": url,
            "en_wordpress": "si" if en_wp else "",
            "en_rastreo": "si" if en_rastreo else "",
            "en_search_console": "si" if en_gsc else "",
            "estado_gsc": estado_gsc,
            "tipo": wp_row.get("tipo", ""),
            "title": rastreo_row.get("title") or wp_row.get("yoast_title") or wp_row.get("title", ""),
            "meta_description": rastreo_row.get("meta_description") or wp_row.get("yoast_metadesc", ""),
            "status_code": rastreo_row.get("status_code", ""),
            "canonical": rastreo_row.get("canonical") or wp_row.get("yoast_canonical", ""),
            "noindex": wp_row.get("yoast_noindex", ""),
            "alertas": alertas_de(url, en_wp, en_rastreo, en_gsc, rastreo_row, redirecciones, estado_gsc),
            "decision": "",
            "url_nueva": "",
            "destino_301": "",
        })

    salida = f"{args.salida.rstrip('/')}/urls.csv"
    columnas = ["url", "en_wordpress", "en_rastreo", "en_search_console", "estado_gsc", "tipo", "title",
                "meta_description", "status_code", "canonical", "noindex", "alertas",
                "decision", "url_nueva", "destino_301"]
    with open(salida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        w.writeheader()
        w.writerows(filas)

    con_alertas = sum(1 for f in filas if f["alertas"])
    print(f"{len(filas)} URLs en {salida} ({con_alertas} con alguna alerta)")


if __name__ == "__main__":
    main()
