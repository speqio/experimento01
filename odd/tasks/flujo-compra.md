# Flujo de compra: confirmación, Webpay y checkout

Rama `fix/flujo-compra`. Asegura los caminos de compra en laboratorio.space.

## Specs

- **S1** `/checkout/confirmacion` must not show an arbitrary order by guessing its ID, and must not fire the GA `purchase` event unless the order was actually paid (it fires only once).
- **S2** When Webpay fails or is rejected, the cart is kept so the customer can retry.
- **S3** When the customer cancels in Webpay, the order is marked `failed` (or `cancelled`) in WooCommerce.
- **S4** `/checkout` with an empty cart redirects to the cart or the shop, or shows an empty state, instead of an empty form.
- **S5** After a network error, the pay button becomes enabled again and shows a visible error.

Checks: `astro check` and the build pass. Manual run on laboratorio after push.

## Tareas

| ID | Spec | Ruta | Commit |
|---|---|---|---|
| T1 | S1 | delegada | pendiente |
| T2 | S2 | delegada | pendiente |
| T3 | S3 | delegada | pendiente |
| T4 | S4 | delegada | pendiente |
| T5 | S5 | delegada | pendiente |

## Log

- **L1** "¿Arranco con los cinco? / procede"
- **L2** The route is delegated because it touches 2 or more non-trivial files: the confirmacion, webpay-commit, checkout and cart files.
- **L3** Implemented S1–S5 uncommitted. S1: confirmacion requires `key` (order_key) matching WooCommerce plus status processing/completed; key added to webpay-commit and free-order redirects. S2: the WooGraphQL checkout empties the cart when creating the order, so checkout saves a snapshot (`cart-snapshot`) and confirmacion restores it on failure. S3: TBK cancel marks `failed` only if the order is still `pending`. S4: /checkout with an empty cart goes to /carrito. S5: try/catch re-enables the button and shows the error. `npm run build` OK; `astro check` not run (@astrojs/check not installed); tsc only reports pre-existing `process` errors.
