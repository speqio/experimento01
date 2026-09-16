# Guía de Despliegue — Cloudflare Workers + CI/CD

## 1. Por qué Workers (no Pages)

Se eligió **Cloudflare Workers** sobre Pages porque es la plataforma unificada actual de Cloudflare, con paridad completa de bindings/secrets y control total sobre las rutas SSR de Webpay (`/api/webpay-init`, `/api/webpay-commit`). El adaptador `@astrojs/cloudflare` soporta ambos targets; este proyecto usa el de Workers.

## 2. Requisitos previos

- Cuenta de Cloudflare con acceso al dominio a migrar (o al menos para crear el Worker con subdominio `*.workers.dev` mientras tanto).
- `wrangler` instalado (`npm install` ya lo trae como devDependency del proyecto; también se puede usar `npx wrangler`).
- Repo en GitHub: `https://github.com/speqio/experimento01`.

## 3. Configuración local del Worker

`astro-frontend/wrangler.toml` define el nombre del Worker y `compatibility_date`. Antes del primer deploy:

```bash
cd astro-frontend
npx wrangler login
```

Configurar los secrets (no se committean, no van en `.env` versionado):

```bash
npx wrangler secret put PUBLIC_WPGRAPHQL_URL
npx wrangler secret put WEBPAY_ENVIRONMENT
npx wrangler secret put WEBPAY_COMMERCE_CODE
npx wrangler secret put WEBPAY_API_KEY
```

## 4. Deploy manual (mientras no hay CI corriendo aún)

```bash
npm run build
npx wrangler deploy
```

## 5. CI/CD — GitHub Actions

`.github/workflows/deploy.yml` corre en cada push a `main`:
1. `npm ci` en `astro-frontend/`.
2. `npm run build`.
3. `wrangler deploy` usando el secret del repo `CLOUDFLARE_API_TOKEN`.

Configurar el secret en GitHub: `Settings → Secrets and variables → Actions → New repository secret` → `CLOUDFLARE_API_TOKEN` (token con permisos de Workers Scripts:Edit, generado en el dashboard de Cloudflare → My Profile → API Tokens).

Los secrets de aplicación (`PUBLIC_WPGRAPHQL_URL`, `WEBPAY_*`) se configuran directamente en el Worker vía `wrangler secret put` (paso 3) — no dependen del CI, persisten entre deploys.

## 6. Migración del DNS del dominio a Cloudflare

El dominio final del proyecto **todavía no está en Cloudflare**. Pasos:

1. Agregar el dominio como sitio nuevo en el dashboard de Cloudflare (`Add a Site`).
2. Cloudflare entrega dos nameservers — actualizarlos en el registrador del dominio actual.
3. Esperar la propagación (Cloudflare notifica cuando el dominio queda activo).
4. En el Worker, ir a `Settings → Domains & Routes → Custom Domains` y enlazar el dominio.
5. Actualizar `PUBLIC_SITE_URL` (secret del Worker) al nuevo dominio.

## 7. Checklist de migración de dominio (a futuro, ida y vuelta)

Cuando el proyecto deba moverse a otro dominio (staging → definitivo, o cambio posterior):

- [ ] `PUBLIC_WPGRAPHQL_URL` actualizado (secret del Worker).
- [ ] `PUBLIC_SITE_URL` actualizado (secret del Worker) — de esto depende la `returnUrl` de Webpay.
- [ ] `Allowed Origins` en WPGraphQL CORS Settings (ver `docs/wp-setup-guide.md §3`) incluye el nuevo dominio.
- [ ] Custom Domain del Worker actualizado en Cloudflare.
- [ ] DNS del nuevo dominio apuntando a Cloudflare.
- [ ] Redeploy (`git push` a `main` si el CI ya está activo, o `wrangler deploy` manual).
- [ ] Prueba end-to-end del flujo Webpay con la nueva `returnUrl`.

## 8. Paso a producción de Webpay (referencia)

Ver `docs/webpay-sequence.md §4` — cambiar `WEBPAY_ENVIRONMENT` a `PRODUCCION` con credenciales reales de Transbank es un paso independiente de la migración de dominio, y no debe ejecutarse hasta tener el código de comercio real.
