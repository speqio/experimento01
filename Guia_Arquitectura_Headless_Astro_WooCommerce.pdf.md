# **Manual de Arquitectura Headless & Guía SDD** 

- E-commerce de Spa, Masajes y Cuidado Personal con WordPress, WooCommerce, Astro & Webpay 

**Metodología:** Spec-Driven Design (SDD) **Stack Frontend:** Astro 4+ (Modo Híbrido) **Entorno Dev:** WordPress Studio + VS 

Code 

## **1. Visión General & Arquitectura del Sistema** 

El proyecto adopta el patrón **Headless CMS** combinando la potencia de administración de contenidos y comercio de WooCommerce con la velocidad y flexibilidad de rendering estático/híbrido de Astro. Bajo la metodología **SpecDriven Design (SDD)** , todo el desarrollo está guiado por un contrato formal de esquemas GraphQL e interfaces de 

TypeScript. 

|**Capas del Sistema**|**Tecnología Seleccionada**|**Rol / Responsabilidad**|
|---|---|---|
|**Frontend Client &**<br>**API**|Astro (SSG / SSR Híbrido) +<br>Tailwind CSS|Catálogo ultrarrápido (SSG), Carrito dinámico, Checkout y endpoints<br>de pago (SSR).|
|**Estado del Carrito**|Nanostores + Session Storage|Reactividad ultra liviana para el estado del carrito en el cliente sin<br>overhead.|
|**Backend CMS &**<br>**Store**|WordPress + WooCommerce + ACF<br>PRO|Gestión de productos, catálogo de masajes, gift cards, pedidos y<br>clientes.|
|**Capa API**<br>**(GraphQL)**|WPGraphQL + WooGraphQL|Exposición de consultas y mutaciones tipadas para productos, gift<br>cards y carrito.|
|**Pasarela de Pago**|Webpay Plus Transbank (Chile)|Procesamiento seguro de transacciones en CLP integrado en Astro<br>mediante SSR.|
|**Entorno Local Dev**|WordPress Studio (Automattic)|Instancia local de WP integrada directamente en VS Code con<br>latencia cero.|



### **2.Configuración del Entorno: WordPress Studio + VS Code(Conexión Directa a Producción)** 

WordPress Studio permite conectar y sincronizar el entorno de trabajo en VS Code directamente con el servidor y dominio de producción, eliminando la sobrecarga de contenedores locales en Docker y facilitando la administración remota de plugins y esquemas de WordPress. 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 1 

##### **Paso a Paso: Instalación de Plugins Oficiales y de GitHub** 

1. **Crear Sitio Local:** Vincular Sitio de Producción: Abre WordPress Studio, selecciona la opción de conexión/sincronización con el servidor remoto e ingresa las credenciales y la URL oficial de tu proyecto en producción (ej: [https://tudominio-spa.cl](https://tudominio-spa.cl)). 

2. **Abrir Carpeta en VS Code** : Abre la raíz de la estructura sincronizada por Studio dentro de tu workspace en VS Code. La ruta de plugins estará vinculada directamente a wp-content/plugins/ en el servidor de producción. 

##### 3. **Verificación de Plugins Preinstalados:** 

Todos los plugins requeridos (WooCommerce, WPGraphQL, WooGraphQL, WPGraphQL CORS, ACF PRO y el plugin de Gift Cards) ya se encuentran instalados en el servidor de producción. No se requiere descargar ni 

descomprimir manualmente ningún archivo ZIP desde GitHub. 

4. **Activación:** Accede al panel de administración de producción ([https://tudominio-spa.cl/wp-admin] (https://tudominio-spa.cl/wp-admin)) y confirma en Plugins > Plugins instalados que WooCommerce, WPGraphQL, WooGraphQL, WPGraphQL CORS, ACF PRO y Gift Cards se encuentren completamente activos. 

5. **Configurar CORS:** En el panel de administración en GraphQL > CORS Settings, habilita Allow Credentials: true y añade el dominio de producción del frontend Astro (ej: [https://tudominio-spa.cl](https://tudominiospa.cl)) para autorizar el tráfico de datos en vivo. 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 2 

## **3. Estructura Exacta de Directorios y Archivos** 

MI-PROYECTO-SPA/ ├── .vscode/ │ └── settings.json # Configuración multi-root workspace ├── docs/ │ ├── schema-spec.md # Especificación maestra SDD (Contratos GraphQL y Tipos) │ ├── wp-setup-guide.md # Guía de configuración manual para WordPress Admin │ └── webpay-sequence.md # Diagrama de secuencia del flujo de pago Transbank ├── astro-frontend/ # Aplicación Frontend Astro │ ├── src/ │ │ ├── layouts/ │ │ │ ├── BaseLayout.astro # HTML base, SEO y scripts globales │ │ │ └── ECommerceLayout.astro# Layout con Header interactivo, Toast y Footer │ │ ├── components/ │ │ │ ├── common/ # Header, Footer, Toast │ │ │ ├── catalog/ # ProductCard, ServiceCard, ProductGrid │ │ │ ├── upsell/ # ProductUpsell, CheckoutUpsell (Cross-selling) │ │ │ ├── giftcard/ # GiftCardForm (Personalización de tarjetas de regalo) │ │ │ └── cart/ # CartDrawer, CartItem, CartSummary │ │ ├── lib/ │ │ │ ├── wp-graphql.ts # Cliente Fetch con soporte para WooCommerce-Session │ │ │ ├── queries/ # Consultas GraphQL isoladas (products.ts, services.ts, giftcards.ts) │ │ │ └── mutations/ # Mutaciones GraphQL (cart.ts, checkout.ts) │ │ ├── store/ │ │ │ └── cartStore.ts # Estado reactivo global del carrito (Nanostores) │ │ ├── types/ │ │ │ ├── catalog.d.ts # Interfaces para Productos, Masajes (ACF) y Upsells │ │ │ ├── giftcard.d.ts # Interfaces para Tarjetas de Regalo digitales │ │ │ └── checkout.d.ts # Interfaces para Carrito, Envíos y Webpay │ │ └── pages/ │ │ ├── index.astro # Homepage con destacados │ │ ├── tienda/ # Catálogo y detalle [slug].astro de productos │ │ ├── servicios/ # Menú de masajes y detalle [slug].astro con ACF │ │ ├── gift-cards/ # Venta directa de Gift Cards │ │ ├── blog/ # Listado y detalle [slug].astro de artículos │ │ ├── carrito.astro # Vista de carrito con módulo Cross-selling │ │ ├── checkout.astro # Formulario e inicio de Webpay (SSR) │ │ └── api/ │ │ │ │ ├── webpay-init.ts # Endpoint SSR: Crea orden y pide token Transbank │ ├── astro.config.mjs └── webpay-commit.ts# Endpoint SSR: Recibe confirmación de Transbank │ ├── .env.local # Configuración de Astro output: 'hybrid' │ └── package.json # PUBLIC_WPGRAPHQL_URL=http://localhost:8888/graphql └── wp-studio-backend/ # Instancia local de WordPress Studio └── wp-content/ └── plugins/ ├── woocommerce/ ├── wp-graphql/ ├── wp-graphql-woocommerce/ # Unzipped desde GitHub ├── wp-graphql-cors/ # Unzipped desde GitHub ├── advanced-custom-fields-pro/ └── pw-woocommerce-gift-cards/ 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 3 

## **4. Especificación del Contrato de Datos (Interfaces TypeScript)** 

**4.1 Modelos de Catálogo y Masajes (** src/types/catalog.d.ts **)** 

export interface ProductImage { sourceUrl: string; altText?: string; } export interface SimpleProduct { id: string; databaseId: number; name: string; slug: string; description: string; shortDescription: string; price: string; regularPrice: string; stockStatus: 'IN_STOCK' | 'OUT_OF_STOCK'; image: ProductImage; galleryImages?: { nodes: ProductImage[] }; upsellProducts?: { nodes: SimpleProduct[] }; crossSellProducts?: { nodes: SimpleProduct[] }; } export interface SpaServiceACF { durationMinutes: number; bodyZone: string; intensityLevel: 'Suave' | 'Medio' | 'Intenso'; benefits: string[]; contraindications?: string[]; allowGiftCard: boolean; } export interface SpaService { id: string; title: string; slug: string; content: string; featuredImage: ProductImage; spaFields: SpaServiceACF; linkedProduct?: SimpleProduct; } 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 4 

**4.2 Modelos de Gift Cards y Checkout (** src/types/giftcard.d.ts **&** src/types/checkout.d.ts **)** 

export interface GiftCardInput { 

recipientName: string; recipientEmail: string; senderName: string; message: string; deliveryDate?: string; amount: number; } 

export interface CartItemMetaData { 

key: string; value: string; } 

export interface WebpayInitResponse { 

token: string; url: string; } 

export interface CheckoutInput { firstName: string; lastName: string; email: string; phone: string; address1: string; city: string; paymentMethod: 'webpay'; } 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 5 

## **5. Contrato de API GraphQL** 

#### **5.1 Query de Producto con Nodos de Upselling** 

query GetProductBySlug($slug: ID!) { product(id: $slug, idType: SLUG) { id databaseId name slug description shortDescription ... on SimpleProduct { 

price regularPrice stockStatus image { sourceUrl altText } upsellProducts { 

nodes { id name slug ... on SimpleProduct { price image { sourceUrl } } } } } } } 

#### **5.2 Mutación addToCart con MetaData para Gift Cards** 

mutation AddGiftCardToCart($productId: Int!, $extraData: String!) { addToCart( 

input: { productId: $productId quantity: 1 extraData: $extraData } ) { cart { total subtotal contents { itemCount } } } } 

## **6. Flujo de Integración de Pago Webpay Plus (Transbank)** 

Dado que Webpay requiere manejo de tokens y peticiones HTTP POST seguras desde el servidor, el flujo se implementa en los endpoints API SSR de Astro (output: 'hybrid'): 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 6 

##### **Diagrama de Secuencia de Webpay en Astro SSR** 

1. **Cliente en Astro:** Presiona "Pagar con Webpay" en la pantalla de Checkout. 

2. **Fetch a /api/webpay-init.ts:** Astro (SSR) recibe los datos del cliente y crea la orden pendiente en WooCommerce mediante GraphQL o REST API. 

3. **Llamada a Transbank:** Astro utiliza la SDK oficial de Transbank para llamar a 

   - WebpayPlus.Transaction.create() pasando el monto, el buyOrder y la URL de retorno (https:// 

   - tudominio.cl/api/webpay-commit ). 

4. **Redirección a Transbank:** Astro retorna al cliente el token y la url de Transbank. El frontend redirige automáticamente mediante un formulario POST. 

5. **Procesamiento en Transbank:** El usuario ingresa sus datos bancarios y autoriza la compra. 

6. **Retorno a /api/webpay-commit.ts:** Transbank redirige al usuario de vuelta al endpoint SSR de Astro pasando el token por POST/GET. 

7. **Confirmación:** Astro llama a WebpayPlus.Transaction.commit(token). Si la transacción es aprobada 

   - (response_code === 0), Astro actualiza el estado de la orden en WooCommerce a "Completada" y muestra la pantalla de agradecimiento. 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 7 

## **7. Prompt Maestro Consolidado para Claude Code (VS Code)** 

Copia este prompt exacto y pégalo directamente en la terminal o panel de chat de **Claude Code** dentro de tu espacio de trabajo en VS Code para que genere todo el proyecto de manera autónoma siguiendo la especificación SDD: 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 8 

Actúa como un Arquitecto de Software Full-Stack experto en Astro (SSR/SSG), TypeScript, WooCommerce y WPGraphQL. 

Vamos a estructurar y codificar un E-commerce Headless para un Spa y Tienda de Cuidado Personal en Chile con soporte para WooCommerce, Webpay Plus Transbank, Gift Cards digitales y un módulo Upselling. 

de 

El stack técnico es: 

- Frontend: Astro (Modo Híbrido: SSG para catálogo/blog, SSR para carrito/checkout/API Webpay), Tailwind CSS, TypeScript, Nanostores. 

- Backend: WordPress Headless (en WordPress Studio local `http://localhost:8888/graphql`) + WooCommerce + WooGraphQL + Webpay Transbank + ACF PRO + Gift Cards. 

Por favor, ejecuta la metodología Spec-Driven Design (SDD) generando los siguientes archivos y carpetas: 

### PASO 1: Generación de la Documentación TÉCNICA 1. Crea `/docs/schema-spec.md` con el contrato completo de tipos, queries GraphQL y diagramas de arquitectura. 

2. Crea `/docs/wp-setup-guide.md` con las instrucciones paso a paso para configurar los plugins en WordPress Studio (incluyendo la descarga manual de WooGraphQL y WPGraphQL CORS desde GitHub hacia `/wp-content/plugins/`). 

3. Crea `/docs/webpay-sequence.md` con el flujo detallado de integración de Transbank Webpay en endpoints SSR de Astro. 

### PASO 2: Configuración del Proyecto Astro y Tipado TypeScript 

1. Configura Astro en el directorio `astro-frontend` en modo híbrido (`output: 'hybrid'`) e instala `@nanostores/astro`, `nanostores`, `@astrojs/node` y Tailwind CSS. 

2. Crea los archivos de tipos en `src/types/`: 

- `catalog.d.ts`: Interfaces para Productos de Cuidado Personal, Servicios de Spa (ACF) y Upselling. 

- `giftcard.d.ts`: Interfaces para personalización de Gift Cards (monto, destinatario, mensaje). 

- `checkout.d.ts`: Interfaces para Carrito, Datos de Envío, Respuesta y Token de Webpay. 

### PASO 3: Capa de Servicios GraphQL y Estado Reactivo 1. Crea `src/lib/wp-graphql.ts` configurado para leer `PUBLIC_WPGRAPHQL_URL` e incluir la cabecera `WooCommerce-Session`. 

2. Crea `src/lib/queries/products.ts`, `services.ts` y `giftcards.ts` con las consultas GraphQL exactas. 

3. Crea `src/lib/mutations/cart.ts` y `checkout.ts`. 

4. Crea `src/store/cartStore.ts` con Nanostores para gestionar el carrito reactivo, persistencia de sesión de WooCommerce y cálculo de sugerencias de Cross-selling. 

### PASO 4: Componentes Interactivos y Páginas SSR/SSG 1. Crea `src/components/giftcard/GiftCardForm.tsx` (Componente para configurar la tarjeta de regalo antes de añadir al carrito). 

2. Crea `src/components/upsell/CheckoutUpsell.tsx` (Widget de Cross-selling dentro del carrito). 

3. Crea las rutas dinámicas y estáticas: 

- `src/pages/servicios/[slug].astro` (Detalle del masaje con opción de compra estándar o regalo en Gift Card). 

- `src/pages/carrito.astro` (Vista del carrito con el componente de Upsell). 

- `src/pages/api/webpay-init.ts` (Endpoint SSR que crea la orden y solicita token a Transbank). 

- `src/pages/api/webpay-commit.ts` (Endpoint SSR que confirma el pago y actualiza WooCommerce). 

Inicia con un breve resumen del plan de ejecución y procede inmediatamente con el PASO 1. 

Metodología Spec-Driven Design — Headless E-Commerce Spa 

Página 9 

