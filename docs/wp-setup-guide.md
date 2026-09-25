# Guía de Configuración de WordPress (staging)

Todos los plugins requeridos ya están **activados** en el sitio de staging: WooCommerce, WPGraphQL, WPGraphQL for WooCommerce (WooGraphQL), WPGraphQL CORS, ACF PRO, y el mu-plugin propio `mandala-giftcards.php` (reemplaza a YITH Gift Cards). Esta guía cubre solo lo que falta: **configurarlos**. No requiere instalar ni descargar nada nuevo.

El desarrollo se conecta **directo al WordPress de staging alojado en cPanel** — sin WordPress Studio ni ningún entorno local de WordPress. La configuración de plugins se hace en el wp-admin del sitio (o vía WP-CLI si cPanel expone Terminal/SSH), y ACF PRO puede configurarse también editando directamente los archivos Local JSON en `wp-content/` si hay acceso SFTP/File Manager.

## 1. WooCommerce — ajustes base

`WooCommerce → Ajustes → General`
- Ubicación de la tienda: Chile.
- Moneda: Peso chileno (CLP), sin decimales.
- Países de venta: Chile (ajustar si aplica envío internacional).

`WooCommerce → Ajustes → Envío`
- Configurar al menos una zona de envío para Chile con los métodos que uses (despacho a domicilio / retiro en tienda).

`WooCommerce → Ajustes → Pagos`
- Dejar únicamente **Webpay Plus (Transbank)** activo como pasarela — los demás métodos por defecto (transferencia, cheque, contra reembolso) desactivarlos si no se usan, para que el checkout headless no los muestre por error.

## 2. WPGraphQL — exposición del esquema

`GraphQL → Configuración`
- Confirmar que el endpoint responde en `https://<tu-dominio-staging>/graphql`.
- Public Introspection: déjalo activado solo mientras se desarrolla; desactívalo antes de pasar a producción.

## 3. WPGraphQL CORS — habilitar el frontend

`GraphQL → CORS Settings` (o `Ajustes → GraphQL CORS`, según versión del plugin)
- **Allowed Origins**: agrega, uno por línea:
  - `http://localhost:4321` (dev local con Astro)
  - la URL del Worker de Cloudflare (`https://<nombre-worker>.<subdominio>.workers.dev`)
  - el dominio final una vez migrado el DNS a Cloudflare
- **Allowed Headers**: `Content-Type, woocommerce-session`.
- **Allow Credentials**: déjalo en `false`/sin marcar. El carrito usa el header `woocommerce-session` (JWT), no cookies, así que no necesitamos `credentials: 'include'` en el cliente — de hecho el navegador **bloquea** esa combinación cuando `Allowed Origins` responde con `*` en vez de un origen específico. Si el plugin permite configurar orígenes explícitos, mejor reemplazar el `*` por defecto por la lista de arriba.

> Cuando migres de dominio (ver `deployment-guide.md`), vuelve a este panel y agrega el nuevo origen — es el único lugar del backend que hay que tocar.

## 4. ACF (versión gratuita) — campos de Servicios de Spa

El servidor tiene instalada **ACF gratuito** (no ACF PRO), que no incluye el campo "Repetidor" (Repeater). Por eso `benefits` y `contraindications` se modelan como **Área de texto simple, un beneficio/contraindicación por línea**, y se separan en un arreglo del lado del frontend (`.split('\n')`) en vez de venir ya como arreglo desde GraphQL.

`Custom Fields → Grupos de Campos → Añadir nuevo`

Crea un grupo **"Campos de Servicio de Spa"** asignado al tipo de contenido que uses para servicios (Custom Post Type `spa_service` o el que corresponda), con estos campos:

| Nombre del campo | Tipo ACF | Notas |
|---|---|---|
| `duration_minutes` | Número | Duración del masaje/servicio en minutos. |
| `body_zone` | Texto | Zona corporal tratada. |
| `intensity_level` | Selección (Suave / Medio / Intenso) | Coincide con `SpaServiceACF.intensityLevel`. |
| `benefits` | Área de texto (textarea) — un beneficio por línea | El frontend separa por salto de línea; se mapea a `benefits: string[]`. |
| `contraindications` | Área de texto (textarea, opcional) — una por línea | Mismo tratamiento que `benefits`; se mapea a `contraindications?: string[]`. |
| `allow_gift_card` | Verdadero/Falso | Si el servicio puede regalarse como gift card. |
| `linked_product` | Relación (Producto WooCommerce) | Vincula el servicio con el producto vendible en WooCommerce. |

En `Configuración de GraphQL` del grupo de campos: activa **"Show in GraphQL"** y define el nombre del tipo como `SpaServiceACF` (debe calzar con `src/types/catalog.d.ts`).

## 5. Gift Cards — mu-plugin propio

No se usa ningún plugin de terceros (YITH/PW quedan como referencia; no deben estar activos para esto). La lógica está en `wordpress/mu-plugins/mandala-giftcards.php`, que se sube a `wp-content/mu-plugins/` y aparece en *Plugins → Must-Use*:

1. Guarda los datos del regalo (email comprador, email destinatario, mensaje) recibidos por `addToCart.extraData`.
2. Al pasar la orden a `processing`/`completed` genera un cupón de **100%** de un solo uso, atado al producto o variante comprada (vigencia 12 meses, filtro `mandala_gift_validity_months`), y envía el email con el código.
3. Registra el método de pago `webpay` (gateway mínimo) para que la mutación `checkout` cree la orden; el cobro real lo hace Astro.
4. No requiere configurar productos "Gift Card": cualquier producto (simple o variable) puede regalarse.

Requisitos en WooCommerce: cupones habilitados, moneda CLP, compra como invitado permitida, y SMTP configurado para que lleguen los emails.

## 6. Verificación final

Antes de conectar el frontend, confirma en `Plugins → Plugins instalados` que están **activos**: WooCommerce, WPGraphQL, WPGraphQL for WooCommerce, WPGraphQL CORS, ACF PRO, y que aparezca el mu-plugin en la pestaña Must-Use.

Prueba el endpoint GraphQL directamente (ej. con un cliente como Insomnia/Postman o `curl`) contra `https://<tu-dominio-staging>/graphql` con la query de `docs/schema-spec.md §4.1` antes de correr el frontend — así aíslas si un problema es del backend o del cliente Astro.

## 7. Claves REST de WooCommerce (checkout headless)

El servidor Astro marca las órdenes como pagadas tras Webpay usando la REST API de WooCommerce.

1. `WooCommerce → Ajustes → Avanzado → REST API → Añadir clave`. Usuario: un administrador; permisos: **Lectura/Escritura**.
2. Copia `Consumer key` (ck_…) y `Consumer secret` (cs_…) — solo se muestran una vez.
3. Local: ponlas en `astro-frontend/.env` como `WC_REST_KEY` y `WC_REST_SECRET` (no se commitea).
4. Producción (Cloudflare): `wrangler secret put WC_REST_KEY` y `wrangler secret put WC_REST_SECRET`.
5. `WooCommerce → Ajustes → General`: habilitar cupones y moneda CLP. `Ajustes → Cuentas y privacidad`: permitir compra como invitado.
6. Subir `wordpress/mu-plugins/mandala-giftcards.php` (incluye el método de pago `webpay` y las gift cards).
