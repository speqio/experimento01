import type { APIRoute } from 'astro';

// Sube la foto que el comprador elige para personalizar el diseño de su gift
// card (ver components/giftcard/GiftCardModal.tsx). Corre en Cloudflare
// Workers, sin librerías nativas (nada de `sharp`, por eso la validación acá
// es liviana): se valida tamaño + firma de bytes, y el reprocesado real de la
// imagen lo hace WordPress (GD/Imagick) al crear el adjunto en Medios.
export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const SIGNATURES: { mime: string; ext: string; check: (b: Uint8Array) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    ext: 'png',
    check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    check: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = { ...import.meta.env, ...process.env, ...((locals as any).runtime?.env ?? {}) } as Record<
      string,
      string | undefined
    >;

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'No se recibió ningún archivo.' }, 400);
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return json({ error: 'La imagen debe pesar menos de 5MB.' }, 400);
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    // Firma de bytes, no el Content-Type declarado (que cualquiera puede falsear) —
    // así se rechaza cualquier archivo que no sea realmente JPEG/PNG/WebP (SVG incluido,
    // por el riesgo de <script> embebido).
    const signature = SIGNATURES.find((s) => s.check(buffer));
    if (!signature) {
      return json({ error: 'Solo se aceptan imágenes JPEG, PNG o WebP.' }, 400);
    }

    const wpOrigin = env.PUBLIC_WPGRAPHQL_URL ? new URL(env.PUBLIC_WPGRAPHQL_URL).origin : '';
    const user = env.WP_MEDIA_APP_USER;
    const pass = env.WP_MEDIA_APP_PASSWORD;
    if (!wpOrigin || !user || !pass) {
      // Temporal: dice cuál falta exactamente, para diagnosticar el binding de
      // secretos en Cloudflare (Workers vs Pages, entorno Production/Preview, etc.).
      const missing = [
        !wpOrigin && 'PUBLIC_WPGRAPHQL_URL',
        !user && 'WP_MEDIA_APP_USER',
        !pass && 'WP_MEDIA_APP_PASSWORD',
      ].filter(Boolean).join(', ');
      return json({ error: `La subida de fotos no está configurada (falta: ${missing}). Avisa al administrador.` }, 500);
    }

    // Nombre generado por el servidor — nunca el nombre original del archivo.
    const filename = `gift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${signature.ext}`;
    const auth = btoa(`${user}:${pass}`);
    const res = await fetch(`${wpOrigin}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': signature.mime,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'User-Agent': 'MandalaGiftUpload/1.0',
      },
      body: buffer,
    });

    // Se lee como texto primero (no .json() directo): si WordPress devuelve HTML
    // (login, error 500, bloqueo de un firewall/plugin de seguridad) en vez de JSON,
    // acá queda un mensaje diagnosticable en vez de un genérico "Unexpected token '<'".
    const rawBody = await res.text();
    let media: { source_url?: string; message?: string } = {};
    try {
      media = JSON.parse(rawBody);
    } catch {
      console.error(`gift-photo-upload: WP respondió ${res.status}, no-JSON: ${rawBody.slice(0, 300)}`);
      return json(
        { error: `WordPress no devolvió una respuesta válida (status ${res.status}). Puede ser un firewall/plugin de seguridad bloqueando la subida — revisa los logs.` },
        502,
      );
    }

    if (!res.ok || !media.source_url) {
      console.error(`gift-photo-upload: WP respondió ${res.status}: ${rawBody.slice(0, 300)}`);
      return json({ error: media.message || 'No se pudo subir la imagen. Inténtalo de nuevo.' }, 502);
    }

    return json({ url: media.source_url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
