# Migración del dominio laboratorio.space a Cloudflare + frontend Astro

Guía paso a paso para conectar el dominio raíz `laboratorio.space` al frontend Astro (Cloudflare Workers), manteniendo WordPress/WooCommerce como backend headless en `cms.laboratorio.space`, sin cortar correo, calendario/contactos ni ningún otro servicio del hosting actual.

## Estado previo (ya hecho)

- [x] `cms.laboratorio.space` creado en cPanel, con el mismo document root que `laboratorio.space` (`/home2/laborato/public_html`) — sirve el mismo WordPress/WooCommerce. Verificado: `/`, `/graphql` y `/wp-admin/` responden igual que en el dominio raíz.
- [x] Pipeline CI/CD (GitHub Actions → Cloudflare Workers) funcionando de punta a punta, con datos reales del catálogo (`PUBLIC_WPGRAPHQL_URL` configurada como Variable de repo de GitHub Actions).
- [x] Export completo del DNS actual de `laboratorio.space` obtenido desde cPanel → Zone Editor.

## Por qué no se puede copiar el DNS 1:1

Cloudflare solo enruta HTTP/HTTPS a través de un hostname "proxied" (naranja) como el que necesita el Worker en el dominio raíz. Varios registros del DNS actual **apuntan literalmente a `laboratorio.space`** como destino para servicios que no son HTTP (correo, CalDAV/CardDAV):

- El `MX` de `laboratorio.space` apunta a `laboratorio.space`.
- El `CNAME` de `mail.laboratorio.space` apunta a `laboratorio.space`.
- Los `SRV` de `_caldav._tcp`, `_carddav._tcp`, `_caldavs._tcp`, `_carddavs._tcp` apuntan a `laboratorio.space`.

Si el dominio raíz queda "proxied" para servir el Worker y estos registros se dejan igual, correo y calendario/contactos se rompen. La solución: repuntar esos registros específicos a `cms.laboratorio.space` (que sigue siendo un acceso directo, sin proxy, al mismo servidor `154.29.73.197`). Todo lo demás se recrea exactamente igual.

## Paso 1 — Agregar el sitio a Cloudflare (sin cambiar nameservers todavía)

1. Entrar al dashboard de Cloudflare → **Add a Site** → escribir `laboratorio.space` → plan Free está bien.
2. Cloudflare escanea el DNS actual e importa lo que encuentra automáticamente. **No confiar solo en ese escaneo** — completar/corregir con la tabla de abajo, porque el escaneo automático no siempre trae todos los `SRV`/`TXT`.
3. Cloudflare entrega **2 nameservers** (algo como `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`). Anotarlos — se usan en el Paso 4, no antes.

## Paso 2 — Cargar los registros DNS en Cloudflare

### 2.1 Van con proxy (nube naranja) — sirven el frontend Astro

Estos se crean automáticamente al agregar el **Custom Domain** en el Worker (Paso 5), no hace falta crearlos a mano aquí — pero hay que asegurarse de que **no queden duplicados** si el escaneo automático de Cloudflare ya los importó como registros normales:

| Host |
|---|
| `laboratorio.space` |
| `www.laboratorio.space` |

Si el escaneo automático los importó como `A`/`CNAME` normales, está bien dejarlos así por ahora (se resuelven o reemplazan en el Paso 5).

### 2.2 Se recrean con destino cambiado a `cms.laboratorio.space` (nube gris / DNS only)

| Tipo | Host | Valor a poner en Cloudflare |
|---|---|---|
| MX | `laboratorio.space` | Prioridad `0`, destino **`cms.laboratorio.space`** |
| CNAME | `mail.laboratorio.space` | **`cms.laboratorio.space`** |
| SRV | `_caldav._tcp.laboratorio.space` | Priority `0`, Weight `1`, Port `2079`, Target **`cms.laboratorio.space`** |
| SRV | `_carddav._tcp.laboratorio.space` | Priority `0`, Weight `0`, Port `2079`, Target **`cms.laboratorio.space`** |
| SRV | `_caldavs._tcp.laboratorio.space` | Priority `0`, Weight `0`, Port `2080`, Target **`cms.laboratorio.space`** |
| SRV | `_carddavs._tcp.laboratorio.space` | Priority `0`, Weight `0`, Port `2080`, Target **`cms.laboratorio.space`** |

### 2.3 Se recrean exactos, sin proxy (nube gris / DNS only)

Todos apuntan directo a `154.29.73.197` salvo donde se indique otro valor:

| Tipo | Host |
|---|---|
| A | `ftp.laboratorio.space` |
| A | `whm.laboratorio.space` |
| A | `cpanel.laboratorio.space` |
| A | `webdisk.laboratorio.space` |
| A | `cpcontacts.laboratorio.space` |
| A | `cpcalendars.laboratorio.space` |
| A | `webmail.laboratorio.space` |
| A | `autodiscover.laboratorio.space` |
| A | `autoconfig.laboratorio.space` |
| A | `cms.laboratorio.space` |
| A | `www.cms.laboratorio.space` |
| A | `cpanel.cms.laboratorio.space` |
| A | `whm.cms.laboratorio.space` |
| A | `webmail.cms.laboratorio.space` |
| A | `cpcontacts.cms.laboratorio.space` |
| A | `cpcalendars.cms.laboratorio.space` |
| A | `autoconfig.cms.laboratorio.space` |
| A | `webdisk.cms.laboratorio.space` |
| A | `autodiscover.cms.laboratorio.space` |
| SRV | `_autodiscover._tcp.laboratorio.space` → target `cpanelemaildiscovery.cpanel.net` (externo, tal cual) |
| SRV | `_autodiscover._tcp.cms.laboratorio.space` → target `cpanelemaildiscovery.cpanel.net` (externo, tal cual) |
| SRV | `_caldav._tcp.cms.laboratorio.space` → target `cms.laboratorio.space`, puerto 2079 |
| SRV | `_carddav._tcp.cms.laboratorio.space` → target `cms.laboratorio.space`, puerto 2079 |
| SRV | `_caldavs._tcp.cms.laboratorio.space` → target `cms.laboratorio.space`, puerto 2080 |
| SRV | `_carddavs._tcp.cms.laboratorio.space` → target `cms.laboratorio.space`, puerto 2080 |
| TXT | `_caldav._tcp.laboratorio.space` → `path=/` (y las mismas para `_carddav`, `_caldavs`, `_carddavs`, y sus equivalentes en `cms.laboratorio.space`) |

### 2.4 TXT — se copian exactos (el proxy no los afecta)

| Host | Valor |
|---|---|
| `_dmarc.laboratorio.space` | `v=DMARC1; p=none;` |
| `laboratorio.space` (SPF) | `v=spf1 +a +mx +ip4:154.29.73.197 include:spf-c.mailbaby.net ~all` |
| `cms.laboratorio.space` (SPF) | `v=spf1 +a +mx +ip4:154.29.73.197 include:spf-c.mailbaby.net ~all` |
| `default._domainkey.laboratorio.space` (DKIM) | copiar tal cual del export |
| `default._domainkey.cms.laboratorio.space` (DKIM) | copiar tal cual del export |
| `_cpanel-dcv-test-record.laboratorio.space` | copiar tal cual — cPanel lo regenera solo cuando lo necesita, no es crítico preservarlo exacto |
| `_acme-challenge.laboratorio.space` | copiar tal cual — igual que el anterior, es temporal para validación SSL |

## Paso 3 — Verificación antes de cambiar nameservers

Con el DNS ya cargado en Cloudflare (pero nameservers todavía en `ns1/ns2.webfriends.cl`), revisar visualmente en el dashboard que:
- No falta ningún registro de las tablas de arriba.
- Los que debían cambiar de destino (`MX`, `mail.`, los 4 `SRV` de cal/card-dav) efectivamente apuntan a `cms.laboratorio.space`, no a `laboratorio.space`.

## Paso 4 — Cambiar los nameservers

En el panel del registrador del dominio (no cPanel — es donde se registró `laboratorio.space`), reemplazar los nameservers actuales (`ns1.webfriends.cl` / `ns2.webfriends.cl`) por los 2 que entregó Cloudflare en el Paso 1. La propagación puede tardar minutos a horas; Cloudflare notifica por email cuando el dominio queda activo.

## Paso 5 — Conectar el dominio al Worker

Una vez Cloudflare confirma el dominio activo:

1. Dashboard de Cloudflare → **Workers & Pages** → `spamandala-astro-frontend` → **Settings → Domains & Routes → Custom Domains** → agregar `laboratorio.space` y `www.laboratorio.space`.
2. Cloudflare crea/ajusta automáticamente los registros DNS proxied necesarios para ambos.

## Paso 6 — Actualizar configuración de la aplicación

- **`PUBLIC_WPGRAPHQL_URL`** → `https://cms.laboratorio.space/graphql`, como **Variable de repo en GitHub Actions** (`Settings → Secrets and variables → Actions → Variables`) — no como secret del Worker (ver `docs/deployment-guide.md §5`).
- **`PUBLIC_SITE_URL`** → `https://laboratorio.space`, como secret del Worker (`wrangler secret put PUBLIC_SITE_URL`) — de esto depende el `returnUrl` de Webpay.
- **`Allowed Origins`** en WPGraphQL CORS (wp-admin, ahora en `cms.laboratorio.space`) → agregar `https://laboratorio.space` (ver `docs/wp-setup-guide.md §3`).
- Confirmar que `WEBPAY_*` sigan seteados como secrets del Worker.
- **Redeploy obligatorio** (`git push` a `main`, o re-ejecutar el workflow) — la variable de build queda incrustada en el bundle anterior.

## Paso 7 — Verificación end-to-end

- [ ] `https://laboratorio.space/` carga el Home del frontend Astro con catálogo real.
- [ ] `https://www.laboratorio.space/` también.
- [ ] `https://cms.laboratorio.space/wp-admin` sigue funcionando.
- [ ] Consulta GraphQL desde el navegador en `https://laboratorio.space` contra `https://cms.laboratorio.space/graphql` sin error de CORS.
- [ ] Enviar y recibir un correo de prueba a/desde una cuenta del dominio (confirma MX + SPF + DKIM intactos).
- [ ] Si usan sincronización de calendario/contactos (CalDAV/CardDAV) desde algún cliente, probar que sigue conectando.
- [ ] Flujo de Webpay de punta a punta con la nueva `PUBLIC_SITE_URL` (returnUrl correcto).
- [ ] Certificado SSL válido tanto en `laboratorio.space` (Cloudflare lo emite automático) como en `cms.laboratorio.space` (AutoSSL de cPanel — debería seguir renovándose solo vía `_acme-challenge`, confirmarlo en el próximo ciclo de renovación).

## Notas para el futuro (Resend / correo saliente)

Cuando se configure Resend (u otra herramienta) para envío transaccional, sus registros de verificación (SPF adicional o `include:`, DKIM, y opcionalmente un registro de tracking) se agregan directo en Cloudflare DNS una vez migrado — no requiere volver a tocar cPanel.
