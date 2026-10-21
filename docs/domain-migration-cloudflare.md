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

## Paso 8 — Baja de ModSecurity (hosting WP)

Antes o en paralelo a los pasos anteriores, pedir al hosting que deshabilite ModSecurity para `cms.laboratorio.space` (o las reglas específicas que bloquean WPGraphQL/REST — típicamente payloads POST con GraphQL o headers custom como el `User-Agent` del Worker, ver `wp-graphql.ts`).

- [ ] Ticket abierto con el hosting pidiendo la baja, especificando el subdominio (no tocar el resto de la cuenta si comparte hosting con otros sitios).
- [ ] Verificación con `curl` directo a `https://cms.laboratorio.space/graphql` desde fuera del Worker, confirmando que ya no devuelve 403.

## Paso 9 — Migración a `spamandala.cl` en dos fases

El CMS (`cms.*`) y el frontend (dominio raíz) son independientes entre sí — el único acople es la URL de GraphQL que usa el Worker. Por eso conviene dividir el corte en dos fases en vez de mover todo de una: primero el CMS, manteniendo el frontend en `laboratorio.space`; recién al final, el dominio raíz.

- **Fase A** (puede hacerse ya, sin esperar nada más): `cms.laboratorio.space` → `cms.spamandala.cl`, con el frontend **sin cambios**, siguiendo en `laboratorio.space` y apuntando su `PUBLIC_WPGRAPHQL_URL` al CMS nuevo.
- **Fase B** (corte final, cuando todo lo demás esté listo): `laboratorio.space` → `spamandala.cl`, solo el dominio raíz/frontend — el CMS ya está en `spamandala.cl` desde la Fase A, así que esta fase no vuelve a tocarlo.

### Fase A — Migrar solo el CMS, frontend sigue en `laboratorio.space`

- [ ] Agregar `spamandala.cl` a Cloudflare (Pasos 1–4 de este documento) — alcanza con tener el subdominio `cms` resuelto, no es necesario mover ya el dominio raíz `spamandala.cl`.
- [ ] En cPanel, agregar `cms.spamandala.cl` como dominio adicional/alias apuntando al mismo document root de WordPress (igual que se hizo con `cms.laboratorio.space` en el "Estado previo").
- [ ] Certificado SSL para `cms.spamandala.cl` (AutoSSL de cPanel).
- [ ] Probar `https://cms.spamandala.cl/graphql` directo (misma query que usa el Worker) **sin** cambiar `siteurl`/`home` de WP todavía — si WP fuerza redirect al dominio canónico, se verá un 301/302 en vez de JSON.
- [ ] Cambiar `WP_HOME`/`WP_SITEURL` (o `siteurl`/`home` en la BD vía WP-CLI) de `cms.laboratorio.space` a `cms.spamandala.cl`.
- [ ] `wp search-replace 'cms.laboratorio.space' 'cms.spamandala.cl'` sobre la BD (correr primero con `--dry-run`).
- [ ] `Allowed Origins` en WPGraphQL CORS: **no cambia** en esta fase — sigue necesitando `https://laboratorio.space`, porque el frontend que consulta sigue ahí.
- [ ] `PUBLIC_WPGRAPHQL_URL` → `https://cms.spamandala.cl/graphql`, como Variable de repo en GitHub Actions, y también en `astro-frontend/wrangler.toml` y `astro-frontend/.env`. `PUBLIC_SITE_URL` **no** cambia — sigue siendo `https://laboratorio.space`.
- [ ] Redeploy obligatorio del Worker.
- [ ] Verificar que `laboratorio.space` sigue funcionando con catálogo real, ahora contra `cms.spamandala.cl`.
- [ ] `cms.laboratorio.space` queda libre para apagarse (o dejarlo como redirect) una vez confirmado esto estable.

### Fase B — Corte final del dominio raíz: `laboratorio.space` → `spamandala.cl`

Una vez la Fase A está estable y ModSecurity dado de baja (Paso 8), se repite el mismo patrón de este documento pero solo para el dominio raíz/frontend — el CMS ya quedó en `spamandala.cl` desde la Fase A.

### 9.1 — Resto del DNS de `spamandala.cl` a Cloudflare

En la Fase A ya se agregó `spamandala.cl` a Cloudflare solo para resolver `cms`. Ahora se completa el resto del dominio raíz, repitiendo el Paso 1–4 completo de este documento para `spamandala.cl` (DNS recreado 1:1, salvedades de MX/SRV/CalDAV-CardDAV de la sección "Por qué no se puede copiar el DNS 1:1", nameservers del registrador).

- [ ] Cargar/completar en Cloudflare todos los registros DNS de `spamandala.cl` (si no se hizo ya al dar de alta `cms` en la Fase A).
- [ ] Cambiar nameservers en el registrador de `spamandala.cl` a los de Cloudflare.

### 9.2 — CORS en WPGraphQL

- [ ] `Allowed Origins` en WPGraphQL → agregar `https://spamandala.cl` (y quitar `https://laboratorio.space` cuando ya no se use, en 9.5).

### 9.3 — Actualizar la aplicación (solo el dominio raíz — el CMS ya está en `spamandala.cl` desde la Fase A)

- [ ] `astro-frontend/wrangler.toml` → `PUBLIC_SITE_URL = "https://spamandala.cl"` en `[vars]` (`PUBLIC_WPGRAPHQL_URL` ya quedó en `cms.spamandala.cl` desde la Fase A, no cambia).
- [ ] `astro-frontend/.env` → mismo cambio para desarrollo local.
- [ ] `astro-frontend/src/lib/wp-graphql.ts` → `WORKER_USER_AGENT` referencia `https://laboratorio.space`, actualizar a `https://spamandala.cl`.
- [ ] `PUBLIC_SITE_URL` como secret del Worker (`wrangler secret put PUBLIC_SITE_URL`) → `https://spamandala.cl` (de esto depende el `returnUrl` de Webpay).
- [ ] Confirmar con Transbank si las URLs de retorno/callback de Webpay están registradas con el dominio viejo — actualizarlas ahí antes de cortar (puede tardar en tramitarse, conviene adelantarlo).
- [ ] Repetir Paso 5 de este documento (Custom Domain del Worker) pero con `spamandala.cl` / `www.spamandala.cl`.
- [ ] Redeploy obligatorio (push a `main` o re-ejecutar workflow) — la variable de build queda incrustada en el bundle anterior.

### 9.4 — Verificación end-to-end (repetir Paso 7 con el dominio nuevo)

- [ ] `https://spamandala.cl/` y `https://www.spamandala.cl/` cargan el Home con catálogo real.
- [ ] `https://cms.spamandala.cl/wp-admin` funciona (ya validado desde la Fase A, se reconfirma).
- [ ] Consulta GraphQL desde `https://spamandala.cl` contra `https://cms.spamandala.cl/graphql` sin error de CORS.
- [ ] Correo, CalDAV/CardDAV siguen funcionando (MX/SPF/DKIM/SRV recreados igual que en el Paso 2).
- [ ] Flujo de Webpay de punta a punta con la nueva `returnUrl` y, si ya se confirmó con Transbank, con las URLs de callback actualizadas.
- [ ] Certificado SSL válido en el dominio raíz nuevo.

### 9.5 — Apagado de `laboratorio.space`

- [ ] Solo después de confirmar 9.4 completo y estable por un período razonable, desactivar o redirigir `laboratorio.space` → `spamandala.cl` (301) en vez de eliminarlo de inmediato, para no perder tráfico/enlaces existentes.
- [ ] Quitar `https://laboratorio.space` de `Allowed Origins` en WPGraphQL CORS una vez confirmado que nada lo usa.
- [ ] `cms.laboratorio.space` ya debería estar apagado desde el cierre de la Fase A; confirmar que sigue siéndolo.

## Notas para el futuro (Resend / correo saliente)

Cuando se configure Resend (u otra herramienta) para envío transaccional, sus registros de verificación (SPF adicional o `include:`, DKIM, y opcionalmente un registro de tracking) se agregan directo en Cloudflare DNS una vez migrado — no requiere volver a tocar cPanel.
