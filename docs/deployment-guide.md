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

Configurar los secrets de runtime (no se committean, no van en `.env` versionado):

```bash
npx wrangler secret put WEBPAY_ENVIRONMENT
npx wrangler secret put WEBPAY_COMMERCE_CODE
npx wrangler secret put WEBPAY_API_KEY
npx wrangler secret put PUBLIC_SITE_URL
```

`PUBLIC_WPGRAPHQL_URL` **no** va aquí — es una variable de build (ver §5), se configura como Variable de repo en GitHub Actions, no como secret del Worker.

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

**Ojo con la diferencia entre variables de build y secrets de runtime** — son dos mecanismos distintos y hay que configurar ambos:

- `PUBLIC_WPGRAPHQL_URL` se usa con `import.meta.env` en `src/lib/wp-graphql.ts`, código que corre tanto en el servidor como en el navegador (islas React como el Header). Vite lo **incrusta en el bundle en tiempo de build** — no sirve configurarlo solo como secret del Worker, porque el código ya quedó compilado sin ese valor. Hay que definirlo como **variable de repositorio de GitHub Actions** (`Settings → Secrets and variables → Actions → pestaña Variables → New repository variable` → `PUBLIC_WPGRAPHQL_URL` = `http://laboratorio.space/graphql`). No es secreto (es una URL pública), por eso va en "Variables" y no en "Secrets". El workflow (`deploy.yml`) ya la pasa al paso de build.
- `PUBLIC_SITE_URL` y `WEBPAY_*` se leen en runtime desde `env` (Cloudflare bindings) en `src/pages/api/webpay-*.ts`, no desde `import.meta.env` — esos sí se configuran con `wrangler secret put` (paso 3) y no requieren rebuild para cambiarlos.

Si `PUBLIC_WPGRAPHQL_URL` no está configurada como variable de repo, el sitio compila y despliega sin errores pero **todas las páginas muestran el catálogo vacío** (el fetch a WordPress falla silenciosamente y cae al `catch` que ya tiene cada página) — este fue exactamente el bug que dejó el primer deploy sin datos.

## 6. Migración del DNS del dominio a Cloudflare

El dominio final del proyecto **todavía no está en Cloudflare**. Pasos:

1. Agregar el dominio como sitio nuevo en el dashboard de Cloudflare (`Add a Site`).
2. Cloudflare entrega dos nameservers — actualizarlos en el registrador del dominio actual.
3. Esperar la propagación (Cloudflare notifica cuando el dominio queda activo).
4. En el Worker, ir a `Settings → Domains & Routes → Custom Domains` y enlazar el dominio.
5. Actualizar `PUBLIC_SITE_URL` (secret del Worker) al nuevo dominio.

## 7. Checklist de migración de dominio (a futuro, ida y vuelta)

Cuando el proyecto deba moverse a otro dominio (staging → definitivo, o cambio posterior):

- [ ] `PUBLIC_WPGRAPHQL_URL` actualizado como **Variable de repo en GitHub Actions** (`Settings → Secrets and variables → Actions → Variables`) — no como secret del Worker, se usa en tiempo de build (ver §5).
- [ ] `PUBLIC_SITE_URL` actualizado (secret del Worker, `wrangler secret put`) — de esto depende la `returnUrl` de Webpay.
- [ ] `Allowed Origins` en WPGraphQL CORS Settings (ver `docs/wp-setup-guide.md §3`) incluye el nuevo dominio.
- [ ] Custom Domain del Worker actualizado en Cloudflare.
- [ ] DNS del nuevo dominio apuntando a Cloudflare.
- [ ] Redeploy (`git push` a `main` si el CI ya está activo, o `wrangler deploy` manual) — **obligatorio** aunque solo haya cambiado la variable de repo, porque `PUBLIC_WPGRAPHQL_URL` queda incrustada en el bundle del build anterior.
- [ ] Verificar que el catálogo ya no muestre "No hay productos disponibles" (sería señal de que la variable de build no llegó al deploy).
- [ ] Prueba end-to-end del flujo Webpay con la nueva `returnUrl`.

## 8. Paso a producción de Webpay (referencia)

Ver `docs/webpay-sequence.md §4` — cambiar `WEBPAY_ENVIRONMENT` a `PRODUCCION` con credenciales reales de Transbank es un paso independiente de la migración de dominio, y no debe ejecutarse hasta tener el código de comercio real.
