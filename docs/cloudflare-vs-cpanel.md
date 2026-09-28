# Frontend en Cloudflare vs. cPanel

Decisión (2026-09-28): **mantener el frontend Astro en Cloudflare Workers** y WordPress/WooCommerce en cPanel como backend headless. Se evaluó migrar el frontend a una Node.js App de cPanel (adaptador `@astrojs/node`) y se descartó.

## Ventajas de Cloudflare
- **Despliegue automático:** cada push a `main` compila y publica. En cPanel sería manual (compilar, subir, reiniciar) o requeriría montar GitHub Actions + FTP/SSH.
- **Sin mantenimiento de servidor:** no hay versiones de Node, Passenger, reinicios ni memoria que gestionar.
- **Velocidad:** el sitio se sirve desde el nodo más cercano al visitante; en cPanel sale de un único servidor.
- **Aislamiento:** un pico de carga en WordPress no afecta al frontend, y viceversa.
- **Seguridad incluida:** HTTPS, mitigación de DDoS, WAF y Bot Fight Mode.
- **Costo:** el plan gratuito de Workers alcanza para este sitio.
- **Ya probado:** el checkout (Webpay + WooCommerce) funciona ahí; migrar reabriría riesgos (Passenger/`PORT`, subdominio nuevo, re-probar la return URL de Webpay).

## Ventajas de cPanel (no determinantes)
- Todo en un solo hosting y una sola factura.
- Más control del servidor.

## Si algún día se migra (resumen)
1. Cambiar el adaptador a `@astrojs/node` (`mode: 'standalone'`), mantener `output: 'hybrid'`.
2. Node App en cPanel con un archivo de arranque que importe `dist/server/entry.mjs`.
3. Publicar en un **subdominio nuevo** (`laboratorio.space` y `cms.laboratorio.space` comparten `/public_html` con WordPress).
4. Actualizar `PUBLIC_SITE_URL` y DNS; volver a probar Webpay.
