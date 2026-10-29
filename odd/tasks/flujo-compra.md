# Flujo de compra: confirmación, Webpay y checkout

Rama `fix/flujo-compra`. Asegura los caminos de compra en laboratorio.space.

## Specs

- **S1** `/checkout/confirmacion` must not show an arbitrary order by guessing its ID, and must not fire the GA `purchase` event unless the order was actually paid (it fires only once).
- **S2** When Webpay fails or is rejected, the cart is kept so the customer can retry.
- **S3** When the customer cancels in Webpay, the order is marked `failed` (or `cancelled`) in WooCommerce.
- **S4** `/checkout` with an empty cart redirects to the cart or the shop, or shows an empty state, instead of an empty form.
- **S5** After a network error, the pay button becomes enabled again and shows a visible error.
- **S6** With a cart of $35.000 or more in RM, the $0 shipping rate is selected automatically (never PAKET when a free rate exists).
- **S7** A cart with only virtual items (services) does not require address, region or comuna.
- **S8** After a failed payment, /carrito shows a total equal to the items subtotal (no stale shipping).
- **S9** `purchase` is sent once per order across tabs/devices (not only per tab).
- **S10** The failure screen tells a cancel apart from a rejection.
- **S11** React hydration errors #418/#423 on /checkout, /carrito and /checkout/confirmacion are fixed.
- **S12** (WooCommerce setting, not code) The free-shipping minimum must not count services.

Checks: `astro check` and the build pass. Manual run on laboratorio after push.

## Tareas

| ID | Spec | Ruta | Commit |
|---|---|---|---|
| T1 | S1 | delegada | pendiente |
| T2 | S2 | delegada | pendiente |
| T3 | S3 | delegada | pendiente |
| T4 | S4 | delegada | pendiente |
| T5 | S5 | delegada | pendiente |
| T6 | S6-S11 | delegada (woo-server.ts, webpay-init.ts, shipping.ts, checkout/index.astro, confirmacion.astro, webpay-commit.ts, CartSummaryPanel.tsx, Header.tsx, useHydrated.ts) | pendiente |

## Log

- **L1** "¿Arranco con los cinco? / procede"
- **L2** The route is delegated because it touches 2 or more non-trivial files: the confirmacion, webpay-commit, checkout and cart files.
- **L3** Implemented S1–S5 uncommitted. S1: confirmacion requires `key` (order_key) matching WooCommerce plus status processing/completed; key added to webpay-commit and free-order redirects. S2: the WooGraphQL checkout empties the cart when creating the order, so checkout saves a snapshot (`cart-snapshot`) and confirmacion restores it on failure. S3: TBK cancel marks `failed` only if the order is still `pending`. S4: /checkout with an empty cart goes to /carrito. S5: try/catch re-enables the button and shows the error. `npm run build` OK; `astro check` not run (@astrojs/check not installed); tsc only reports pre-existing `process` errors.
- **L4** Pedido: "corrige" la lista de fallas de las pruebas E2E del 29-10 (pedidos 41233-41239). S12 queda fuera del código.
- **L5** S6: getShippingOptions elige la tarifa más barata si el cliente no eligió (envío $0 queda marcado). S7: dirección opcional si el carrito no necesita envío (/api/shipping sin región; webpay-init la exige solo con envío). S8: total del carrito = subtotal menos descuentos. S9: guardia de purchase en localStorage. S10: webpay-commit redirige con reason=cancel|rejected y confirmacion muestra textos distintos. S11: Header y CartSummaryPanel pintan lo del servidor hasta hidratar (useHydrated). Pendiente: prueba en laboratorio; S7 puede requerir en WooCommerce que los campos de facturación no sean obligatorios.
