# Flujo de Integración Webpay Plus (Transbank) — Astro SSR

Ambiente actual: **`INTEGRACION`** (sandbox de Transbank). La transición a producción está documentada en `§4` pero no debe ejecutarse hasta contar con credenciales reales.

## 1. Diagrama de secuencia

```
[ Carrito Astro (/carrito) ]
        │ 1. Click "Pagar con Webpay"
        ▼
[ POST /api/webpay-init.ts (SSR) ]
        │ 2. Crea la orden "pendiente" en WooCommerce (mutación GraphQL `checkout` con la sesión del carrito)
        │ 3. `src/lib/webpay.ts` (fetch a la API REST de Webpay) → create(buyOrder, sessionId, amount, returnUrl)
        ▼
[ Transbank ] ──── 4. Devuelve { token, url } ────► [ Astro responde al cliente ]
        │
        ▼
[ Cliente redirige (form POST automático) a `url` + `token` ]
        │
        ▼
[ Formulario Webpay Plus — usuario ingresa datos bancarios y autoriza ]
        │ 5. Transbank redirige de vuelta (POST/GET) a la returnUrl
        ▼
[ POST/GET /api/webpay-commit.ts (SSR) ]
        │ 6. `src/lib/webpay.ts` → commit(token)
        │ 7. Si response_code === 0 → pasa la orden a "processing" por REST (WC_REST_KEY/SECRET)
        │    (esto dispara el mu-plugin: cupón de gift card + email)
        ▼
[ Redirige a /checkout/confirmacion ]
```

## 2. Endpoints SSR

### `src/pages/api/webpay-init.ts` (POST, `prerender = false`)
1. Recibe los datos del checkout (`CheckoutInput`) y el total del carrito (incluyendo el remanente tras aplicar gift card, si corresponde).
2. Crea la orden pendiente en WooCommerce.
3. Llama a `WebpayPlus.Transaction.create()` con:
   - `buyOrder`: id/order number de WooCommerce.
   - `sessionId`: sesión del carrito (`woocommerce-session`).
   - `amount`: total a pagar por Webpay (total del carrito menos saldo de gift card aplicado).
   - `returnUrl`: `${PUBLIC_SITE_URL}/api/webpay-commit`.
4. Responde `WebpayInitResponse { token, url }`.

### `src/pages/api/webpay-commit.ts` (POST/GET, `prerender = false`)
1. Lee el `token_ws` que envía Transbank.
2. Llama a `WebpayPlus.Transaction.commit(token)`.
3. Si `response_code === 0`: marca la orden como completada en WooCommerce y confirma el consumo de saldo de gift card si se usó.
4. Si falla: marca la orden como fallida/cancelada y redirige a una vista de error con opción de reintentar.
5. Redirige a `/checkout/confirmacion?order=<id>`.

## 3. Variables de entorno (sandbox actual)

```
WEBPAY_ENVIRONMENT=INTEGRACION
WEBPAY_COMMERCE_CODE=597055555532
WEBPAY_API_KEY=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C
```

Estas son las credenciales oficiales de prueba de Transbank para integración — válidas para cualquier proyecto en desarrollo, no son secretas.

## 4. Paso a producción (documentado, no ejecutar todavía)

Cuando Transbank entregue el código de comercio real:

1. Solicitar/obtener de Transbank: `commerce_code` y `api_key` de producción.
2. Actualizar los secrets del Worker (`wrangler secret put WEBPAY_ENVIRONMENT`, `WEBPAY_COMMERCE_CODE`, `WEBPAY_API_KEY`) con `WEBPAY_ENVIRONMENT=PRODUCCION` y las credenciales reales.
3. En `transbank-sdk`, instanciar `WebpayPlus` con `Environment.Production` en vez de `Environment.Integration` (esto se lee de `WEBPAY_ENVIRONMENT`, sin cambiar código).
4. Probar el flujo completo con un monto real bajo antes de anunciar el cambio.
5. Confirmar con Transbank el certificado/whitelist de la `returnUrl` de producción.

## 5. Notas de implementación

- Se usa `fetch` contra la API REST de Transbank en vez de `transbank-sdk`: el SDK depende de axios/http y falla en Cloudflare Workers.
- `buy_order` = `order-<id de la orden de WooCommerce>`; el commit lo parsea para saber qué orden actualizar.
- Total $0 (código de gift card canjeado al 100%): Transbank no acepta monto 0, así que `/api/webpay-init` marca la orden `processing` y responde `{ free: true, redirect }`.
- `PUBLIC_SITE_URL` debe ser el dominio exacto con que el cliente abre el sitio (sin `/` final): es la `return_url` de Webpay y el carrito vive en `localStorage` de ese dominio.
