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

**Tarjeta 3D:** el modal muestra la tarjeta con inclinación, brillo y flotación (`src/components/giftcard/GiftCardPreview.tsx`, arte en `public/gift-card.webp`, o el que esté configurado en wp-admin → Gift Cards → Ajustes). Los correos no ejecutan JS/3D, por eso usan una imagen estática equivalente.

**Foto personalizada del comprador:** en el modal, el comprador puede subir su propia foto (JPEG/PNG/WebP, hasta 5MB) para que sea el diseño completo de su gift card, con el logo superpuesto en una esquina. El navegador la compone como tarjeta (aspecto, esquinas y logo) en una sola PNG antes de subirla (`composeCard` en `GiftCardModal.tsx`), así se ve igual en la tarjeta 3D del modal y en el correo. Sin foto, se usa el diseño de fábrica de siempre.
- `astro-frontend/src/pages/api/gift-photo-upload.ts` valida el archivo (tamaño + firma de bytes reales, no el `Content-Type` declarado — solo JPEG/PNG/WebP, SVG explícitamente rechazado por riesgo de script embebido) y lo reenvía a la Biblioteca de Medios de WordPress (`POST /wp-json/wp/v2/media`), que lo reprocesa con GD/Imagick (segunda validación real de que es una imagen).
- Requiere un usuario de WordPress de **mínimo privilegio**, separado de las claves REST de WooCommerce: crear un usuario `giftcard-uploader` con rol Suscriptor (Usuarios → Añadir nuevo), generarle una *Application Password* en su perfil, y cargarla en Cloudflare como los secretos `WP_MEDIA_APP_USER`/`WP_MEDIA_APP_PASSWORD`. El mu-plugin (`mandala-giftcards.php`) le da el permiso de subir archivos a ese usuario puntual vía código (`user_has_cap`), sin subirle el rol completo.
- El mu-plugin valida además que la URL que llega desde el frontend sea del propio WordPress antes de guardarla en la orden (defensa en profundidad).
- Pendiente/no crítico dado el volumen del negocio: sin límite de tasa de subidas propio (se recomienda una regla de Rate Limiting en Cloudflare sobre `/api/gift-photo-upload`, igual que el pendiente ya anotado para `/api/webpay-*`); sin moderación automática de contenido (si alguien sube algo inapropiado, queda visible y revisable en la Biblioteca de Medios de wp-admin); pueden quedar fotos huérfanas en Medios si alguien sube una y abandona el pago.

**Regalar producto + complemento juntos:** si el producto tiene complementos configurados (el mismo sistema "Complementa tu experiencia" de la ficha de producto, ver sección Upsells más abajo), el modal de gift card muestra un checkbox por cada uno. Al marcarlos, todos los items (producto principal + complementos) se agregan al carrito compartiendo un `groupId` generado en el navegador (`crypto.randomUUID()`). Al confirmarse el pago, WordPress agrupa por ese id y emite **un solo cupón** (válido en cualquiera de los productos del grupo) y **un solo correo** ("Incluye también: ..."), en vez de uno por producto — se siente como un único regalo combinado. Las compras de un solo producto (sin complementos marcados) funcionan exactamente igual que antes.

**Correo de regalo:** el template HTML vive en `wordpress/mu-plugins/mandala-giftcards-email.php` (subir junto a `mandala-giftcards.php` a `wp-content/mu-plugins/`). Incluye mockup de la tarjeta con la foto del producto, código, vigencia y botón "Agenda tu hora" (`<frontend>/agenda`). Asunto y remitente usan la marca (`MANDALA_BRAND`, `MANDALA_FROM_EMAIL`), no el título del sitio WordPress. Para poner el logo, subirlo a Medios y definir `MANDALA_EMAIL_LOGO_URL` en ese archivo. Vista previa sin comprar (solo administradores): `https://cms.laboratorio.space/wp-admin/admin-post.php?action=mandala_gift_preview&product=<ID>` (añadir `&mode=buyer` para la copia del comprador, `&send=1` para enviarte una prueba).

**Cómo canjear (en el correo):** se explican dos formas — **Opción 1** desde el sitio: la tarjeta flotante "Usa tu giftcard disponible" pide el correo donde la recibió y el código, los verifica y abre WhatsApp con el mensaje "Hola, quiero hacer uso de mi giftcard. La recibí en {correo} y el código es {código}." (`GiftCardRedeemModal.tsx`); el botón "Cobrar mi gift card" del correo abre ese mismo mensaje de WhatsApp directo, con el correo y el código ya cargados; **Opción 2** por teléfono/WhatsApp/correo (constantes `MANDALA_CONTACT_PHONE`, `MANDALA_CONTACT_WHATSAPP`, `MANDALA_CONTACT_EMAIL` en `mandala-giftcards-email.php`), donde el destinatario indica el email al que le llegó la gift card y su código; el administrador confirma la reserva y marca el código como usado desde wp-admin → Gift Cards → Trazabilidad ("Marcar como usado").

### Panel de gift cards (wp-admin)

`wp-admin → Marketing → Gift Cards` (`wordpress/mu-plugins/mandala-giftcards-admin.php`), tres pestañas:

- **Trazabilidad:** todas las compras hechas "como regalo" — comprador, destinatario, producto, monto, código y estado (Por enviar / Programado / Enviado / Canjeado / Expirado). Filtro Todos/Usados/No usados. Cada fila enlaza a la orden en WooCommerce, y si el código aún no se usó tiene un botón **Marcar como usado** para reservas hechas por teléfono o correo (sube el `usage_count` del cupón para que WooCommerce lo bloquee igual que un canje online, y deja registro de quién y cuándo lo marcó — se ve como "Canjeado manualmente por X el [fecha]").
- **Productos:** checkbox por producto para permitir o no regalarlo. Guarda `_mandala_gift_enabled` en el producto. El link "Editar precio →" abre el producto en WooCommerce (el precio de la gift card siempre es el de la variante elegida, no hay un precio aparte que mantener).
- **Ajustes:** interruptor global (`mandala_gift_enabled`, apaga todas las gift cards del sitio) y selector de imagen de la tarjeta (biblioteca de medios de WordPress) — se usa tanto en la tarjeta 3D del modal como en el correo.

**Sin espera de deploy:** las fichas de producto (`/tienda/[slug]`) y `/gift-cards` son SSR — desactivar un producto u ocultar el botón "Regalar" en el panel se ve de inmediato al recargar, sin esperar un `git push`/deploy. De todas formas WordPress **rechaza la compra en el servidor** por si acaso (ej. alguien tenía la página vieja abierta en el navegador) — nunca se vende una gift card inválida solo por confiar en lo que muestra el frontend.

**Origen del comprador:** `astro-frontend/src/lib/attribution.ts` sigue capturando `utm_source`/`utm_medium`/`utm_campaign` de la URL y `document.referrer` la primera vez que alguien entra al sitio, y viaja como meta `_mandala_attribution` de la orden al pagar — pero ya no se muestra en el panel de Trazabilidad (se sacó por pedido explícito, quedaba innecesario ahí). El dato sigue disponible en la meta de cada orden en WooCommerce por si se retoma más adelante.

## Banners

`wp-admin → Marketing → Banners` (`wordpress/mu-plugins/mandala-banners.php`), con pestañas por banner (hoy **Home** y **Promociones**, se agregan más sumando una fila a `MANDALA_BANNER_KEYS` en ese archivo). Cada uno: imagen (biblioteca de medios), texto superior, título, descripción y hasta dos botones (texto + link). Se expone por GraphQL como `siteBanner(key: "home" | "promociones")`, y si un campo queda vacío la página usa el contenido de fábrica como respaldo (nunca se rompe el diseño por no configurar algo).

## Panel "Marketing" (wp-admin)

Gift Cards y Banners viven bajo un solo menú, **Marketing** (`wordpress/mu-plugins/mandala-admin-ui.php`), con una página de aterrizaje de accesos directos a cada sección. Este archivo no tiene lógica de negocio propia — solo registra el menú padre y encola el CSS de marca compartido (`assets/admin-ui.css`) que le da a ambos paneles la misma identidad visual del sitio (tabs redondeados, tarjetas, colores de marca) en vez de los estilos genéricos de WordPress. Subir junto a los demás mu-plugins, incluida la carpeta `assets/`.

**Home (`/`) y Promociones (`/promociones`) son SSR:** un cambio de banner en wp-admin se ve de inmediato al recargar la página, sin esperar un deploy.

## Blog

Usa las **Entradas** nativas de WordPress (Posts) — sin ACF ni tipo de contenido propio, WPGraphQL ya las expone de fábrica (`posts`/`post`). WordPress entrega título, contenido, extracto, imagen destacada y categoría; Astro (`src/pages/blog/index.astro`, `blog/[slug].astro`, `src/components/blog/BlogCard.astro`) decide el layout, igual que ya hace con los productos. Páginas SSR (no estáticas): un artículo nuevo aparece sin esperar un deploy. El contenido del artículo se sanitiza con `cleanHtml()` (`lib/sanitize.ts`), el mismo mecanismo que ya se usa para las descripciones de producto.

## Variables de entorno

No secretas (en `astro-frontend/wrangler.toml`, `[vars]`): `PUBLIC_SITE_URL` (dominio exacto que usa el cliente), `PUBLIC_WPGRAPHQL_URL`, `WEBPAY_ENVIRONMENT`, `WEBPAY_COMMERCE_CODE`.
Secretas (panel de Cloudflare → Variables and Secrets; localmente en `.env`): `WEBPAY_API_KEY`, `WC_REST_KEY`, `WC_REST_SECRET`, `WP_MEDIA_APP_USER`, `WP_MEDIA_APP_PASSWORD` (subida de fotos personalizadas de gift card, ver sección Gift cards).

## Estado / pendientes

Avance detallado por etapa (briefing, prototipo, desarrollo, Q&A, testing): dashboard del proyecto en claude.ai, pestaña **Tareas**.

### Avances del 2026-10-27

- **Checkout en una pantalla:** secciones desplegables, resumen del pedido y RUT y notas opcionales. El botón se bloquea al pagar para no duplicar pedidos. Se quitó «sin costo en el pedido» del texto de envíos.
- **Redirección corregida:** `/checkout` ya no redirige a `/carrito/`, porque la tabla 301 heredada tapaba la página de pago.
- **Rediseño de un colaborador externo** (`8581b40`): portada, tienda con filtros, cabecera, pie, notificación del carrito y animaciones GSAP.
- **Fichas de producto caídas y repuestas** (`ff05bdc`): el parche agregó `productCategories` al fragmento de tarjetas y todas las fichas daban 404. Las 10 consultas de `products.ts` se validaron contra el CMS.
- **Cabeceras de seguridad en el HTML:** HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` y `Permissions-Policy` las pone ahora `src/middleware.ts`, porque `public/_headers` solo llega a los archivos estáticos.
- **Sin 404 por fallas del CMS:** si WordPress falla, fichas y entradas responden 503 con `Retry-After`. Así Google no da la página por eliminada.
- **Títulos iguales a producción:** pasaron de 19 a 344 de 405 coincidencias con el rastreo de spamandala.cl. Vienen de `src/data/titulos-wp.json`, generado con `migracion/_herramientas/titulos_wp.py`; las rutas nuevas usan la plantilla «Nombre | Spa Mandala».
- **Sitemap:** 182 URLs, todas con 200, con barra final igual que el canonical y que lo indexado en producción.
- **Redirecciones:** las 400 responden 301 correcto y sus 112 destinos devuelven 200.
- **PageSpeed móvil:** el hero tiene `srcset` (480/720/960); las tarjetas, una variante de 360 px; los logos pasaron a WebP; y las diapositivas ocultas no descargan su imagen hasta acercarse su turno.
- **Observabilidad:** el log de `webpay-init` ahora incluye el mensaje del error, no solo el stack.

### Avances del 2026-10-29

- **Pruebas de compra con Webpay de integración** (pedidos 41233 a 41249): envío pagado, envío gratis, regiones, carrito mixto, solo servicios, cancelación, rechazo y gift card. Todas pasan.
- **Confirmación protegida:** `/checkout/confirmacion` exige la clave del pedido y que esté pagado; `purchase` se envía una vez por pedido (también entre pestañas).
- **Carrito tras un fallo:** se guarda una copia antes de ir a Webpay y se restaura si el pago falla. La pantalla distingue cancelado de rechazado.
- **Cancelar en Webpay** marca el pedido como fallido si seguía pendiente.
- **Checkout:** con el carrito vacío lleva a `/carrito`; si falla la red, el botón de pagar vuelve a activarse; un carrito solo de servicios ya no pide dirección.
- **Envío gratis automático** desde $35.000 y total de `/carrito` sin envío viejo. Errores de hidratación de React corregidos.
- **Envío gratis solo por lo que se despacha:** el mu-plugin `mandala-envio-gratis.php` descarta la tarifa gratis si los productos físicos no llegan al mínimo (antes contaba los servicios). Se sube por cPanel y hay que volver a subirlo si se reinstala el CMS.

### Pendientes

- **500 en `/api/webpay-init`:** hubo 4 en `createOrderFromCart`. Parecen envíos concurrentes, pero no está confirmado; revisar el próximo caso en los logs, que ya traen el mensaje.
- **Imagen LCP del hero:** el banner del CMS se sirve en tamaño completo. Falta un campo `imageSrcset` en `wordpress/mu-plugins/mandala-banners.php`, que hay que subir por cPanel.
- **Favicon:** no existe (`/favicon.ico` da 404). Falta el archivo, junto con el logo en alta resolución y la imagen social de 1200×630.
- **CSP:** no está activa en el HTML. Probarla primero en modo reporte, porque GTM carga scripts de otros dominios.
- **JSON-LD:** faltan datos estructurados en `/agenda/`, `/gift-cards/`, `/promociones/` y `/blog/`. Yoast tenía `enable_schema = 1`, así que probablemente producción los tenía.
- **Títulos sin coincidir:** quedan unas 60 diferencias; la mayoría son URLs viejas que redirigen. Falta confirmar la corrección del título de las entradas del blog (`76d3fa1`).
- **Configuración fuera del código:**
  - Caché de 1 año para `/wp-content/uploads/` en el hosting del CMS (hoy son 7 días).
  - Desactivar el beacon RUM de Cloudflare si no se usa.
- **`/api/shipping` lento:** tarda 2–3 s por llamada.
- **Checkout:** mostrar un mensaje de «sin stock» en vez del error genérico de `webpay-init`; ocultar dirección, región y comuna en carritos solo de servicios.
- **Corte a producción:**
  - GTM de producción y variables con el dominio real.
  - Limpieza de los datos de prueba.
  - `WP_ORIGIN_HOST`.
  - Delta de pedidos y gift cards.
  - Webpay en `PRODUCCION`.
  - Seguimiento contra la línea base a las 2, 4 y 8 semanas.
- **WordPress (seguridad):** mantener apagada la introspección de GraphQL, limitar CORS al dominio del frontend, bloquear `xmlrpc.php` y ocultar la lista de usuarios de la REST API.
