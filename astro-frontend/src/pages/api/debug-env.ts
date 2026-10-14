import type { APIRoute } from 'astro';
import { WORKER_USER_AGENT } from '../../lib/wp-graphql';

// ponytail: diagnóstico temporal para el incidente de PUBLIC_WPGRAPHQL_URL —
// borrar en cuanto se confirme la causa (no expone secretos, solo URLs).
export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const runtime = (locals as any)?.runtime;
  const url = import.meta.env.PUBLIC_WPGRAPHQL_URL;

  let fetchResult: unknown = null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': WORKER_USER_AGENT },
      body: JSON.stringify({ query: '{ products(first:1){ nodes { name } } }' }),
    });
    const text = await res.text();
    fetchResult = { ok: res.ok, status: res.status, bodyStart: text.slice(0, 300) };
  } catch (e) {
    fetchResult = { error: (e as Error).message, stack: (e as Error).stack?.slice(0, 500) };
  }

  return new Response(
    JSON.stringify(
      {
        importMetaEnv: url ?? null,
        runtimeEnv: runtime?.env?.PUBLIC_WPGRAPHQL_URL ?? null,
        hasKv: !!runtime?.env?.WP_CACHE,
        fetchResult,
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
