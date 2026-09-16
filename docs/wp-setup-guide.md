# Guía de Configuración de WordPress (staging)

Todos los plugins requeridos ya están **activados** en el sitio de staging: WooCommerce, WPGraphQL, WPGraphQL for WooCommerce (WooGraphQL), WPGraphQL CORS, ACF PRO y el plugin de Gift Cards. Esta guía cubre solo lo que falta: **configurarlos**. No requiere instalar ni descargar nada nuevo.

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
- **Allow Credentials**: `true` (imprescindible para mantener el carrito entre peticiones vía `woocommerce-session`).
- **Allowed Origins**: agrega, uno por línea:
  - `http://localhost:4321` (dev local con Astro)
  - la URL del Worker de Cloudflare (`https://<nombre-worker>.<subdominio>.workers.dev`)
  - el dominio final una vez migrado el DNS a Cloudflare
- **Allowed Headers**: `Content-Type, woocommerce-session`.

> Cuando migres de dominio (ver `deployment-guide.md`), vuelve a este panel y agrega el nuevo origen — es el único lugar del backend que hay que tocar.

## 4. ACF PRO — campos de Servicios de Spa

`Custom Fields → Grupos de Campos → Añadir nuevo`

Crea un grupo **"Campos de Servicio de Spa"** asignado al tipo de contenido que uses para servicios (Custom Post Type `spa_service` o el que corresponda), con estos campos:

| Nombre del campo | Tipo ACF | Notas |
|---|---|---|
| `duration_minutes` | Número | Duración del masaje/servicio en minutos. |
| `body_zone` | Texto | Zona corporal tratada. |
| `intensity_level` | Selección (Suave / Medio / Intenso) | Coincide con `SpaServiceACF.intensityLevel`. |
| `benefits` | Repetidor de texto o Área de texto (una línea por beneficio) | Se mapea a `benefits: string[]`. |
| `contraindications` | Repetidor de texto (opcional) | Se mapea a `contraindications?: string[]`. |
| `allow_gift_card` | Verdadero/Falso | Si el servicio puede regalarse como gift card. |
| `linked_product` | Relación (Producto WooCommerce) | Vincula el servicio con el producto vendible en WooCommerce. |

En `Configuración de GraphQL` del grupo de campos: activa **"Show in GraphQL"** y define el nombre del tipo como `SpaServiceACF` (debe calzar con `src/types/catalog.d.ts`).

## 5. Plugin de Gift Cards — modo saldo/crédito

Este proyecto usa las gift cards como **saldo/crédito de tienda combinable con Webpay**, no como código de un solo uso. En la configuración del plugin:

1. Define el/los producto(s) de tipo "Gift Card" (montos fijos o monto libre, según lo que necesites vender).
2. Activa la opción de que el saldo se **aplique como crédito en el checkout** (vía cupón/crédito automático), en vez de "canjear una vez y agotar".
3. Verifica que si el saldo de la gift card **no cubre el total**, el checkout deje el remanente `needsPayment = true` para cobrarlo por Webpay en la misma compra (ver `docs/schema-spec.md §4.3`).
4. Configura el envío del código por email al destinatario (asunto, remitente, plantilla) con los campos de personalización: nombre del destinatario, mensaje, fecha de entrega.
5. Si el plugin soporta vencimiento, decide si lo activas (opcional; no bloqueante para el MVP).

## 6. Verificación final

Antes de conectar el frontend, confirma en `Plugins → Plugins instalados` que están **activos**: WooCommerce, WPGraphQL, WPGraphQL for WooCommerce, WPGraphQL CORS, ACF PRO, plugin de Gift Cards.

Prueba el endpoint GraphQL directamente (ej. con un cliente como Insomnia/Postman o `curl`) contra `https://<tu-dominio-staging>/graphql` con la query de `docs/schema-spec.md §4.1` antes de correr el frontend — así aíslas si un problema es del backend o del cliente Astro.
