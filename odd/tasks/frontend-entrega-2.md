# Integrar entrega 2 del frontend (cambios.patch)

Rama `feat/frontend-entrega-2`. Parche externo generado desde `3467dba` (no existe en este repo) hasta `50da6fa`.

## Specs

- S1. Integrar los cambios de `cambios.patch` / `resumen-entrega.txt` resolviendo conflictos. El usuario ya validó visualmente la versión del colaborador: en lo visual manda su versión.
- S2. No perder los arreglos hechos después de `8581b40`: `ff05bdc` (productCategories en fragmento en línea), `ab5b142` (503 si falla el CMS), `f9425d1`/`76d3fa1` (títulos SEO), `95e0629` (cabeceras y sitemap), `d1853e4`/`9043b4b` (srcset, 360 px, logos WebP, carga diferida del hero).
- S3. `npm run build` pasa sin errores.

## Tareas

- [x] T1 (S1, S2) Aplicar con 3 vías y resolver conflictos — ruta inline. Sin commit (pendiente de pedido del usuario).
- [x] T2 (S3) Build y revisión de marcadores de conflicto.

## Log

- L1: "mira las siguientes rutas son los cambios de frontend cambios.patch resumen-entrega.txt que quiero introducir al proyecto" / "hazlo en una rama aparte y resuelve los conflictos ... ya comprobé visualmente y todo está como corresponde".
- L2: `git apply --3way --directory=astro-frontend`: 13 archivos con 78 bloques en conflicto. Criterio: versión del colaborador (validada visualmente), salvo `queries/products.ts` (ellos reintroducían el bug de `ff05bdc`) y `Footer.astro` (logo WebP de `d1853e4`).
- L3: Se reaplicó a mano lo perdido de `d1853e4`/`9043b4b`: variante 360 px en tarjetas de familias, `heroSrcset`, carga diferida de diapositivas (`loadSlide`) y logo WebP en `Header.tsx`.
- L4: Verificado: 503 de `ab5b142`, `titleFor` de `f9425d1`, `package.json`/`_headers`/`.gitignore` ya iguales a la entrega. Sin marcadores de conflicto. `npm run build` OK.
