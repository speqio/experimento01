# Spa Headless — WordPress + Astro + WooCommerce + Webpay

E-commerce headless de Spa, Masajes y Cuidado Personal. Metodología Spec-Driven Design (SDD).

## Documentación

- [`docs/schema-spec.md`](docs/schema-spec.md) — contrato de tipos, queries/mutations GraphQL y arquitectura.
- [`docs/wp-setup-guide.md`](docs/wp-setup-guide.md) — configuración de los plugins de WordPress (staging, alojado en cPanel).
- [`docs/webpay-sequence.md`](docs/webpay-sequence.md) — flujo de integración Webpay Plus.
- [`docs/deployment-guide.md`](docs/deployment-guide.md) — despliegue en Cloudflare Workers + CI/CD + migración de dominio.

## Desarrollo local

```bash
cd astro-frontend
cp .env.example .env
npm install
npm run dev
```

Se conecta directo al WordPress de staging alojado en cPanel (sin entorno local de WordPress Studio) — ajusta `PUBLIC_WPGRAPHQL_URL` en `.env` con la URL real del sitio de staging.

## Stack

- **Frontend**: Astro 4 (híbrido SSG/SSR) + Tailwind CSS + Nanostores, desplegado en Cloudflare Workers.
- **Backend**: WordPress + WooCommerce + ACF PRO + WPGraphQL + WooGraphQL + mu-plugin propio de Gift Cards (`wordpress/mu-plugins/mandala-giftcards.php`).
- **Pagos**: Webpay Plus (Transbank) vía API REST con `fetch` (`src/lib/webpay.ts`), ambiente `INTEGRACION` (sandbox).
- **Agenda**: página `/agenda` con iframe de Reservo (`RESERVO_URL` en `src/lib/siteInfo.ts`).

## Gift cards

Cualquier producto puede comprarse "como regalo" (botón *Quiero mi giftcard*, modal con email del comprador, email del destinatario y mensaje). Los productos son variables (sesiones/horas): la ficha exige elegir variante.

1. El regalo viaja en `addToCart` como `extraData`; el mu-plugin lo guarda en el ítem del carrito y de la orden.
2. `/api/webpay-init` crea la orden en WooCommerce (mutación `checkout`) y cobra el total real por Webpay. Si el total es $0 salta Webpay.
3. `/api/webpay-commit` confirma con Transbank y pasa la orden a *processing* por REST (`WC_REST_KEY`/`WC_REST_SECRET`).
4. Al pasar a *processing*, el mu-plugin crea un cupón de 100% atado al producto/variante regalado, de un solo uso, y envía el código por email al destinatario (copia al comprador).
5. El destinatario ingresa el código en el checkout y el ítem queda en $0.

## Variables de entorno

No secretas (en `astro-frontend/wrangler.toml`, `[vars]`): `PUBLIC_SITE_URL` (dominio exacto que usa el cliente), `PUBLIC_WPGRAPHQL_URL`, `WEBPAY_ENVIRONMENT`, `WEBPAY_COMMERCE_CODE`.
Secretas (panel de Cloudflare → Variables and Secrets; localmente en `.env`): `WEBPAY_API_KEY`, `WC_REST_KEY`, `WC_REST_SECRET`.

## Estado / pendientes

- Probado en staging: WordPress `cms.laboratorio.space`, frontend `laboratorio.space`. Pendiente confirmar la prueba de compra completa (pago → orden *processing* → cupón → email → canje a $0).
- Email saliente puede requerir SMTP en el hosting.
- Pasar a producción: repetir en el WordPress definitivo la subida del mu-plugin, claves REST y ajustes de WooCommerce; Webpay con credenciales reales (`PRODUCCION`).
