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

**Antifraude del código:** código aleatorio de 12 caracteres (no adivinable), `usage_limit(1)` (WooCommerce lo bloquea a nivel de núcleo apenas se usa una vez) y **restringido al email del destinatario** (`set_email_restriction`) — si alguien reenvía o intercepta el correo, no puede canjearlo con un email distinto al que se lo enviamos. Se puede desactivar con el filtro `mandala_gift_lock_to_recipient_email` si genera fricción real (ej. alguien agenda por otra persona).

**Envío programado:** en el modal, el comprador puede elegir una fecha de envío (opcional, hasta 180 días). El cupón se crea igual al confirmarse el pago, pero el correo se despacha ese día a las 09:00 (hora del sitio) vía `wp_schedule_single_event` (WP-Cron), en vez de salir de inmediato. Es idempotente (meta `_mandala_gift_sent`), así que no se duplica si WP-Cron corre varias veces. **Requiere que WP-Cron corra puntual**: si el sitio recibe poco tráfico, configura en cPanel un cron real que golpee `wp-cron.php` cada 15-30 min (ver comentario al inicio de `mandala-giftcards.php`).

**Tarjeta 3D:** el modal muestra la tarjeta con inclinación, brillo y flotación (`src/components/giftcard/GiftCardPreview.tsx`, arte en `public/gift-card.webp`). Los correos no ejecutan JS/3D, por eso usan la imagen estática `public/gift-card-email.jpg` (servida en `<frontend>/gift-card-email.jpg`); si cambia el arte, hay que regenerarla.

**Correo de regalo:** el template HTML vive en `wordpress/mu-plugins/mandala-giftcards-email.php` (subir junto a `mandala-giftcards.php` a `wp-content/mu-plugins/`). Incluye mockup de la tarjeta con la foto del producto, código, vigencia, pasos de canje y botón "Agenda tu hora" (`<frontend>/agenda`). Asunto y remitente usan la marca (`MANDALA_BRAND`, `MANDALA_FROM_EMAIL`), no el título del sitio WordPress. Para poner el logo, subirlo a Medios y definir `MANDALA_EMAIL_LOGO_URL` en ese archivo. Vista previa sin comprar (solo administradores): `https://cms.laboratorio.space/wp-admin/admin-post.php?action=mandala_gift_preview&product=<ID>` (añadir `&mode=buyer` para la copia del comprador, `&send=1` para enviarte una prueba).

### Panel de gift cards (wp-admin)

`wp-admin → WooCommerce → Gift Cards` (`wordpress/mu-plugins/mandala-giftcards-admin.php`), tres pestañas:

- **Trazabilidad:** todas las compras hechas "como regalo" — comprador, destinatario, producto, monto, código y estado (Por enviar / Programado / Enviado / Canjeado / Expirado). Filtro Todos/Usados/No usados. Cada fila enlaza a la orden en WooCommerce, y si el código aún no se usó tiene un botón **Marcar como usado** para reservas hechas por teléfono o correo (sube el `usage_count` del cupón para que WooCommerce lo bloquee igual que un canje online, y deja registro de quién y cuándo lo marcó — se ve como "Canjeado manualmente por X el [fecha]").
- **Productos:** checkbox por producto para permitir o no regalarlo. Guarda `_mandala_gift_enabled` en el producto. El link "Editar precio →" abre el producto en WooCommerce (el precio de la gift card siempre es el de la variante elegida, no hay un precio aparte que mantener).
- **Ajustes:** interruptor global (`mandala_gift_enabled`, apaga todas las gift cards del sitio) y selector de imagen de la tarjeta (biblioteca de medios de WordPress) — se usa tanto en la tarjeta 3D del modal como en el correo.

**Importante — caché del sitio:** las fichas de producto (`/tienda/[slug]`) son páginas estáticas generadas en el build. Desactivar un producto u ocultar el botón "Regalar" en el panel no lo hace desaparecer del sitio ya desplegado hasta el próximo `git push`/deploy. Por eso WordPress igual **rechaza la compra en el servidor** de inmediato aunque el botón siga visible — nunca se vende una gift card inválida.

**Origen del comprador:** `astro-frontend/src/lib/attribution.ts` sigue capturando `utm_source`/`utm_medium`/`utm_campaign` de la URL y `document.referrer` la primera vez que alguien entra al sitio, y viaja como meta `_mandala_attribution` de la orden al pagar — pero ya no se muestra en el panel de Trazabilidad (se sacó por pedido explícito, quedaba innecesario ahí). El dato sigue disponible en la meta de cada orden en WooCommerce por si se retoma más adelante.

## Variables de entorno

No secretas (en `astro-frontend/wrangler.toml`, `[vars]`): `PUBLIC_SITE_URL` (dominio exacto que usa el cliente), `PUBLIC_WPGRAPHQL_URL`, `WEBPAY_ENVIRONMENT`, `WEBPAY_COMMERCE_CODE`.
Secretas (panel de Cloudflare → Variables and Secrets; localmente en `.env`): `WEBPAY_API_KEY`, `WC_REST_KEY`, `WC_REST_SECRET`.

## Estado / pendientes

**Probado (2026-09-25):** compra de regalo en staging (frontend `laboratorio.space`, WordPress `cms.laboratorio.space`): pago Webpay de integración → orden en *Procesando* en WooCommerce.

**Pendientes:**
- **Emails:** no llegan porque el hosting no tiene SMTP. Crear una casilla en cPanel (ej. no-reply@laboratorio.space), instalar WP Mail SMTP o FluentSMTP en `cms.laboratorio.space`, probar el envío y revisar SPF/DKIM. El mu-plugin ya envía con `wp_mail()`; no requiere cambios de código.
- Verificar que el cupón de 100% se crea al pasar a *Procesando* (WooCommerce → Marketing → Cupones) y probar el **canje** (mismo producto/variante, total $0).
- La orden #678 salió con $239.200, 20% menos que los $299.000 de las otras: revisar si hay algún descuento o promoción activa que aplique sin querer.
- Pasar a producción: repetir en el WordPress definitivo la subida del mu-plugin, claves REST y ajustes de WooCommerce; Webpay con credenciales reales (`PRODUCCION`).
- **Seguridad** (el código del navegador no se puede ocultar; se protege el backend y se limita lo que expone el frontend):
  - Frontend: cabeceras de seguridad en Cloudflare (CSP, `X-Frame-Options`, `Referrer-Policy`); confirmar que ningún secreto llegue al cliente (solo variables `PUBLIC_*`); WAF y Bot Fight Mode para proteger `/api/webpay-init` y `/api/webpay-commit`.
  - WordPress (`cms.laboratorio.space`): mantener desactivada la introspección de GraphQL en producción; limitar CORS al dominio del frontend en vez de `*`; bloquear `xmlrpc.php`; ocultar la lista de usuarios de la REST API.
- Opcional: fecha de entrega programada del email de regalo (YITH la tenía).
