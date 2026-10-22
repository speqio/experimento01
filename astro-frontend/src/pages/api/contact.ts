import type { APIRoute } from 'astro';
import { wpRestUrl, WORKER_USER_AGENT } from '../../lib/wp-graphql';
import { isRateLimited } from '../../lib/rateLimit';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Formulario de /contacto → WordPress (wordpress/mu-plugins/mandala-contact.php), que envía el correo.
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { name, phone, email, message, website } = await request.json();
    // Campo trampa invisible: los bots lo llenan, las personas no. Se responde "ok" para no darles pistas.
    if (website) return json({ ok: true });
    if (await isRateLimited(locals, request, 'contact', 5, 3600)) {
      return json({ ok: false, error: 'Demasiados mensajes. Escríbenos por WhatsApp.' }, 429);
    }
    const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
    const data = { name: clean(name, 120), phone: clean(phone, 40), email: clean(email, 160), message: clean(message, 5000) };
    if (!data.name || !data.phone || !EMAIL.test(data.email) || data.message.length < 5) {
      return json({ ok: false, error: 'Completa nombre, celular, un correo válido y tu mensaje.' }, 400);
    }

    const env = { ...import.meta.env, ...process.env, ...((locals as any).runtime?.env ?? {}) } as Record<string, string | undefined>;
    const origin = env.PUBLIC_WPGRAPHQL_URL ? new URL(env.PUBLIC_WPGRAPHQL_URL).origin : '';
    if (!origin || !env.WP_MEDIA_APP_USER || !env.WP_MEDIA_APP_PASSWORD) {
      return json({ ok: false, error: 'El formulario no está configurado. Escríbenos por WhatsApp.' }, 500);
    }
    const res = await fetch(wpRestUrl(origin, '/mandala/v1/contacto'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': WORKER_USER_AGENT,
        Authorization: `Basic ${btoa(`${env.WP_MEDIA_APP_USER}:${env.WP_MEDIA_APP_PASSWORD}`)}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) return json({ ok: false, error: 'No pudimos enviar tu mensaje. Escríbenos por WhatsApp.' }, 502);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: 'No pudimos enviar tu mensaje. Escríbenos por WhatsApp.' }, 500);
  }
};
