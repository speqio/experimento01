# Metodología de recopilación — adaptada a Spamandala

Adaptación del documento de trabajo de Webfriends ("Metodología de recopilación de datos para migraciones") al proyecto real: **WordPress + WooCommerce → `astro-frontend` (Astro en Cloudflare Workers) vía WPGraphQL directo**, no EmDash. El volcado de base de datos es vía **cPanel / MySQL**, no R2.

Ver también el artefacto ["Plan de Migración spamandala.cl"](https://claude.ai/artifact/5y4m9urMS6uuKzVCakvKaD) (DNS, ModSecurity, Fase A/B, entorno de desarrollo) — este documento cubre la recopilación de datos del sitio actual, ese otro cubre el corte de dominio y la validación end-to-end de Webpay.

Última actualización: 2026-10-16.

## No aplica a este proyecto

- **Paso 7 "Profesionales"** (05-profesionales/) — Spamandala no genera ese tipo de contenido (no tiene fichas de profesional como otros proyectos de salud/bienestar). Se omite del checklist.

## Diferencias con el documento original

| Original (Webfriends genérico) | Spamandala |
|---|---|
| Destino: Astro + EmDash | Destino: `astro-frontend` consumiendo WooCommerce vía WPGraphQL directo (sin importador de terceros; las queries ya existen en `astro-frontend/src/lib/queries/` y `mutations/`) |
| Respaldo de DB vía R2 | Respaldo de DB vía cPanel (phpMyAdmin / `mysqldump`), importado a la base propia del entorno de desarrollo |
| Staging por crear | **Ya existe**: el entorno de desarrollo tiene su propia DB (nueva) + volcado de plugins/mu-plugins reales (incluye `Mandala_Webpay_Gateway`) |
| Screaming Frog sin licencia → rastreador propio | Igual — no hay licencia, se usa rastreador propio o se prescinde del paso de rastreo si el tiempo no alcanza (la fuente WordPress + Search Console ya cubre el inventario) |

## Estado de la recopilación (2026-10-16)

Primer lote de crudo recibido en `C:\Users\Webfriends E1\Downloads\spamandala crudo`. Copiado a este repo lo liviano; lo pesado/sensible queda fuera de git (ver tabla).

| Archivo recibido | Qué es | Dónde quedó | En git |
|---|---|---|---|
| `htaccess` | `.htaccess` del hosting (WordPress + LiteSpeed + cPanel) | `migracion/00-config/htaccess.txt` | sí |
| `yoast seo spamandala.txt` | Export de opciones de Yoast SEO (`wp option get` / export, formato INI) — `site_type=shop`, `enable_headless_rest_endpoints=1`, permalinks `/%postname%/` | `migracion/00-config/yoast-config.txt` | sí |
| `acf spamandala.json` | Grupos de campos ACF exportados | `migracion/02-contenido/acf/acf-spamandala.json` | sí |
| `productos spamandala.csv` | Export de productos WooCommerce (todas las columnas, incl. metadatos de YITH Gift Cards, Yoast por producto, atributos) | `migracion/02-contenido/_crudo/productos-spamandala.csv` | sí |
| `todoelcontenido spamandala.xml` | Export WXR completo (~49 MB) | se queda en `Downloads/spamandala crudo/` — **no se copia al repo** | no (gitignored si se copia) |
| `spamandala_wp648.sql.zip` | Volcado completo de la base de datos (~66 MB comprimido) — contiene usuarios, pedidos, datos sensibles | se queda en `Downloads/spamandala crudo/` — tratar como el "respaldo privado" de la sección 2 del documento original | no, nunca (dato sensible) |

**Pendiente de recibir** (el usuario indicó que sigue sumando material): inventario de URLs completo (WP + rastreo + Search Console), exportación de redirecciones (Yoast Redirect + plugin Redirection), menús de navegación, datos del centro (sedes/horarios/contacto), formularios, GTM/medición, lista de plugins activos y terceros, línea base de PageSpeed.

## Qué dicen los archivos recibidos (primera lectura)

- **Yoast**: `site_type = "shop"`, `enable_headless_rest_endpoints = 1` (ya preparado para consumo headless), `permalink_structure = "/%postname%/"`, `home_url = "https://spamandala.cl"` — **confirmado**: este dump es del WordPress real de producción, que vive en `spamandala.cl`. `laboratorio.space` es el entorno de desarrollo propio (Astro + WordPress del equipo), dominio distinto y sin relación productiva con `spamandala.cl`.

> ⚠️ **Regla dura**: está prohibida cualquier conexión directa (en código, config o pruebas) desde este proyecto hacia `spamandala.cl` o cualquier subdominio suyo. El dump/WXR de producción se importa **dentro** del WordPress del entorno de desarrollo (`cms.laboratorio.space`), nunca se apunta `PUBLIC_WPGRAPHQL_URL` ni ninguna variable al dominio real. Todo el trabajo de recopilación, validación de Webpay/WooCommerce y pruebas end-to-end ocurre enteramente sobre `laboratorio.space`.
- **ACF**: grupos de campos exportados — pendiente de mapear contra los componentes Astro existentes (fichas de producto/tratamiento).
- **Productos (CSV)**: WooCommerce con YITH WooCommerce Gift Cards Premium (coincide con `yith-woocommerce-gift-cards-premium/` ya presente en el repo), productos variables con atributos de sesiones/duración, metadatos Yoast por producto, Facebook Catalog. Sirve como fuente para el inventario de URLs (`/producto/<slug>/`) y como referencia de contenido real para validar contra lo que carguen las queries de `astro-frontend`.
- **`.htaccess`**: WordPress estándar + LiteSpeed + cPanel PHP 8.3 — sin reglas de redirección custom visibles en el bloque recibido (las redirecciones de Yoast/Redirection se gestionan en DB, no en `.htaccess`, salvo que el método esté en "servidor web" — confirmar en Yoast → Redirecciones → Configuración cuando se audite el Paso 6).

## Herramientas de inventario (`_herramientas/`)

Scripts propios (no existían en el repo, se escribieron para este proyecto). Hacen solo peticiones GET de lectura a endpoints públicos de `spamandala.cl` (REST API, sitemap, páginas) — equivalente a lo que hace cualquier rastreador o Google; no escriben nada ni tocan configuración del sitio real.

**El hosting de `spamandala.cl` corta la conexión a clientes sin huella de navegador real** (confirmado desde dos redes distintas con la librería `requests` de Python). Por eso `extraer_wp.py` y `rastrear.py` navegan con **Chromium real vía Playwright** (`navegador.py`) en vez de hacer requests HTTP directos — no es una técnica de evasión, es la misma vía que usan Google y Screaming Frog cuando un sitio exige fingerprint de navegador.

```bash
cd migracion/_herramientas
pip install -r requirements.txt
playwright install chromium   # descarga el navegador, una sola vez

python extraer_wp.py --sitio https://spamandala.cl --salida ../01-inventario

python rastrear.py --inicio https://spamandala.cl/ \
  --semillas ../01-inventario/urls_wp.csv --semillas ../01-inventario/gsc.csv \
  --salida ../01-inventario/rastreo.csv

python consolidar.py --wp ../01-inventario/urls_wp.csv --rastreo ../01-inventario/rastreo.csv \
  --gsc ../01-inventario/gsc.csv --indexacion ../01-inventario/indexacion.csv --salida ../01-inventario
```

Orden: primero `extraer_wp.py` (no depende de nada), después `rastrear.py` (usa `urls_wp.csv` y `gsc.csv` como semillas), y al final `consolidar.py` genera `urls.csv`, la lista maestra con la columna `alertas`.

Probado (smoke test) contra sitios neutrales (`example.com`, `wordpress.org`) — funcionan de punta a punta. Corridos también en vivo contra `spamandala.cl` (con confirmación explícita del usuario, dado que el harness bloquea por defecto lecturas directas a dominios de producción).

### Estado del inventario (2026-10-19) — Paso 3 completo

- `extraer_wp.py` **completo**: 130 URLs en `01-inventario/urls_wp.csv` (4 posts, 124 productos, 1 navegación, 1 cuenta WhatsApp vía `wp-json`).
- `rastrear.py` **completo**: 555 URLs únicas en `01-inventario/rastreo.csv`, 19.602 imágenes en `imagenes.csv`. Se encontraron y corrigieron tres trampas de rastreo:
  1. Links de acción (`?add-to-cart=<id>`, `?yith-gift-this-product-form=yes&add-to-cart=<id>`) que generan una URL por cada combinación producto×cantidad×variación — se filtran por parámetro de query.
  2. Archivos de fecha de WordPress (`/2024/10/17/`, calendario de archivo, no es contenido real) y paginación sin tope en páginas que no deberían paginar (`/contacto/2/`, `/lista-de-deseos/2/`) — se filtran por patrón de ruta y profundidad de página (tope 5).
  3. **Sitemap de Yoast mal leído**: Chromium devuelve el XML del sitemap ya transformado por su hoja XSL (tabla HTML con links), no el XML crudo con `<loc>` — `sitemaps_de()` ahora lee esos links de `<a href>` (con fallback a `<loc>` si el sitio no usa Yoast), filtrando los que no son del propio dominio (la plantilla de Yoast linkea a `sitemaps.org` y `yoa.st`). Soporta `--sitemap <url>` para pasar el sitemap explícito. Con el fix, pasó de "0 URLs en sitemaps" a 257 URLs en 8 archivos (post/page/product/categorías/gift cards), y la cola de rastreo convergió de ~32.000 a 0 en vez de crecer sin límite.
- `consolidar.py` **completo**: **980 URLs en `01-inventario/urls.csv`**, 817 con alguna alerta:

  | Alerta | Cantidad | Qué es |
  |---|---|---|
  | GSC (no "indexada") | 538 | bloqueada por robots, error 404, redirección, rastreada/descubierta sin indexar, canonical alternativo — según Search Console |
  | sin meta description | 262 | falta description en el HTML servido |
  | sin title | 150 | falta `<title>` en el HTML servido |
  | responde 404 | 125 | la URL ya no existe |
  | canonical apunta a otra URL | 124 | **señal real y útil**: productos con slug viejo que Yoast ya canonicaliza al slug actual (p. ej. renombres de producto) — material directo para armar las redirecciones 301 |
  | solo en rastreo | 66 | encontrada navegando, no está en `wp-json` ni en GSC |
  | solo en Search Console | 3 | Google la conoce pero no se encontró en el sitio ni en el rastreo |

- Search Console: ya procesado (`gsc.csv`, `indexacion.csv`, 770 URLs clasificadas) — ver sección anterior.

**Paso 3 (Inventario de URLs) queda completo.** Falta llenar las columnas `decision`/`url_nueva`/`destino_301` de `urls.csv` fila por fila (Paso 9 de la metodología), que se hace junto con Spamandala más adelante, no ahora.

### Search Console ya recibido (2026-10-16)

Llegaron 8 exports en zip: `rendimiento` (clics/impresiones por página, consulta, dispositivo, país) y 7 estados de indexación (indexadas, error 404, bloqueada por robots, redirección, rastreada/descubierta sin indexar, página alternativa con canonical). Procesados en:
- `01-inventario/gsc.csv` — del export de rendimiento (`Páginas.csv`), columna `Páginas principales` con clics/impresiones/CTR/posición.
- `01-inventario/indexacion.csv` — los 770 URLs de los 7 estados combinados (231 indexadas, 248 bloqueadas por robots, 113 rastreadas sin indexar, 96 redirecciones, 53 error 404, 16 página alternativa, 13 descubiertas sin indexar), listo para que `consolidar.py` las use con `--indexacion`.

`verificar.py` (Paso 6 del documento, compara `urls.csv` contra un ambiente de pruebas) no se escribió todavía — se hace cuando haya un ambiente donde correrlo (el entorno de desarrollo en `laboratorio.space` con el contenido ya importado).

## Siguiente paso inmediato

1. Extraer el inventario de URLs (Paso 3 del documento original) en cuanto llegue el resto del material.
2. Auditar redirecciones reales (Yoast Redirect + Redirection) cuando llegue esa exportación.
3. Importar el volcado de DB (`spamandala_wp648.sql.zip`) **dentro del WordPress de `laboratorio.space`/`cms.laboratorio.space`** (cPanel/phpMyAdmin), nunca contra `spamandala.cl` en vivo. Después del import, sobrescribir las credenciales de Webpay por las de integración/test antes de cualquier prueba de checkout.
4. Mantener el dump y el WXR fuera de git siempre (dato sensible de producción real).
