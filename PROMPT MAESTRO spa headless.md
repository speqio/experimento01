### **PROMPT MAESTRO RENOVADO** 

Actúa como un Arquitecto Full-Stack Senior especializado en Astro (SSR/SSG Hybrid), TypeScript estricto, WooCommerce GraphQL y pasarelas de pago (Transbank Webpay Plus). 

#### OBJETIVO: 

Construir la arquitectura frontend Headless para un E-commerce de Spa y Cuidado Personal conectándose DIRECTAMENTE al dominio de WordPress remoto activo (sin pasar por entornos locales de WordPress Studio). 

VARIABLES DE ENTORNO (.env.local): 

- PUBLIC_WPGRAPHQL_URL=https://tudominio.com/graphql 

- PUBLIC_SITE_URL=http://localhost:4321 

- WEBPAY_ENVIRONMENT=INTEGRACION 

- WEBPAY_COMMERCE_CODE=597055555532 

- 

WEBPAY_API_KEY=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0 A36B1C 

REQUERIMIENTOS TÉCNICOS Y ESTRUCTURA: 

1. Configuración del Proyecto: 

- Configura `astro.config.mjs` en modo híbrido (`output: 'hybrid'`) utilizando el adaptador de Node.js o Vercel. 

- Integra Tailwind CSS y `@nanostores/persistent`. 

2. Tipado TypeScript (`src/types/`): 

- `wp-graphql.d.ts`: Interfaces para Productos, Categorías, Campos Personalizados (ACF para Spa/Servicios) y Gift Cards. 

- `cart.d.ts`: Tipos para la sesión del carrito WooCommerce y mutaciones WooGraphQL. 

- `webpay.d.ts`: Payload de inicio, respuesta de Transbank y confirmación del token. 

3. Cliente GraphQL Remoto (`src/lib/wp-graphql.ts`): 

- Configura una función `fetchAPI` genérica que consuma 

- `import.meta.env.PUBLIC_WPGRAPHQL_URL`. 

- Incluye soporte automático para la cabecera `woocommerce-session` almacenada en cookies/localStorage. 

- Habilita `credentials: 'include'` para persistencia de la cookie de sesión del servidor remoto. 

4. Estado del Carrito (`src/store/cartStore.ts`): 

- Crea un store reactivo con Nanostores para agregar, quitar y actualizar ítems. 

- Sincroniza las mutaciones de GraphQL (`addToCart`, `updateItemQuantities`, 

- `removeItemsFromCart`). 

5. Rutas SSR para Checkout Webpay (`src/pages/api/`): 

- `webpay-init.ts` (POST): Genera la transacción en Transbank vía `transbank-sdk`, guarda la orden en WooCommerce y retorna la URL + token de pago. 

- `webpay-commit.ts` (POST/GET): Endpoint de retorno desde Transbank. Valida el token, confirma la transacción y redirige a la vista de éxito (`/checkout/confirmacion`). 

6. Páginas y Componentes Astro: 

- `src/pages/index.astro`: SSG con productos y servicios destacados. 

- `src/pages/carrito.astro`: SSR reactivo mostrando los ítems del carrito y botón de checkout. 

- `src/pages/checkout/confirmacion.astro`: SSR para procesar la respuesta final de Webpay. 

Ejecuta el paso 1 y 2 inmediatamente proponiendo la estructura de archivos y el código exacto. 

# **GUÍA DE ARQUITECTURA HEADLESS (Astro + WooCommerce Remoto)** 

### **1. Resumen de la Arquitectura** 

- [ Cliente / Navegador ] 

│ ├── (1) Renderizado SSG/SSR ──────► [ Astro Frontend (Puerto 4321) ] │                                           │ ├── (2) GraphQL Queries/Mutations ──────────┼──► [ WP Remoto: tudominio.com/graphql ] 

│                                           │ └── (3) Pago Transbank Webpay ──────────────┘ 

### **2. Matriz de Renderizado (Hybrid Strategy)** 

|**Tipo de Página**<br>**/ Ruta**|**Método Astro**|**Razón de la Elección**|
|---|---|---|
|**Inicio y**<br>**Catálogo**|export const<br>prerender = true<br>(SSG)|Máxima velocidad de carga, SEO<br>óptimo e imágenes optimizadas en<br>build.|
|**Ficha de**<br>**Producto / Spa**|export const<br>prerender = true<br>(SSG)|Generación estática basada en rutas<br>dinámicas de WooGraphQL.|



|**Carrito de**<br>**Compras**|Dynamic (SSR)|Requiere datos en tiempo real de la<br>sesión activa del usuario.|
|---|---|---|
|**Rutas API**<br>**Webpay**|Dynamic (SSR)|Manejo de secretos, firmas<br>criptográficas y endpoints de retorno<br>POST/GET.|



### **3. Configuración del Servidor WordPress Remoto** 

Para permitir llamadas desde el puerto local verifica estas opciones en el WP Admin de tu servidor: 

### **CORS (WP GraphQL Settings)** 

- **Allowed Origins:** <mark>http://localhost:4321, [https://tudominio-frontend.com](https://tudominio-frontend.com)</mark> 

- 

- **Allowed Headers:** <mark>Content-Type, Authorization, woocommerce-session</mark> 

- 

- **Allow Credentials:** <mark>true</mark> (Crucial para mantener el carrito entre peticiones HTTP) 

- 

### **Plugins Requeridos en Producción** 

- WP GraphQL 

- 

- WooGraphQL (WP GraphQL WooCommerce) 

- 

- WPGraphQL for ACF (Campos de servicios de spa) 

- 

- Transbank Webpay Plus REST para WooCommerce 

- 

### **4. Flujo de Transacción Webpay Plus** 

- [ Carrito Astro ] ──(1. POST /api/webpay-init)──► [ Transbank SDK ] 

- │ (Retorna URL + Token) 

[ Formulario Webpay Transbank ] ◄──(2. Redirección)─────┘ │ ├── (3. Usuario paga) ▼ [ POST /api/webpay-commit ] ──(4. Valida Token)──► [ Transbank API ] │                                               │ (Transacción OK) 

└──(5. Actualiza Orden en WPGraphQL) ───────────┘ │ └──(6. Redirige a /checkout/confirmacion) 

## **5. Snippet Base: Cliente WPGraphQL** **<mark>(</mark>** <mark>src/lib/wp-graphql.ts</mark> **<mark>)</mark>** 

export async function wpQuery<T>({ query, variables = {} }: { query: string; variables?: object }): Promise<T> { const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('woo-session') : ''; 

const res = await fetch(import.meta.env.PUBLIC_WPGRAPHQL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sessionToken ? { 'woocommerce-session': `Session ${sessionToken}` } : {}), }, body: JSON.stringify({ query, variables }), }); // Capturar nueva sesión enviada por WooCommerce const newSession = res.headers.get('woocommerce-session'); if (newSession && typeof window !== 'undefined') { localStorage.setItem('woo-session', newSession); } const { data, errors } = await res.json(); if (errors) throw new Error(errors[0].message); 

return data as T; } 

