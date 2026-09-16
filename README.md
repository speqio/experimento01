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
- **Backend**: WordPress + WooCommerce + ACF PRO + WPGraphQL + WooGraphQL + Gift Cards (modo saldo/crédito).
- **Pagos**: Webpay Plus (Transbank), ambiente `INTEGRACION` (sandbox).
