import type { APIRoute } from 'astro';

// ponytail: diagnóstico temporal para el incidente de PUBLIC_WPGRAPHQL_URL —
// borrar en cuanto se confirme la causa (no expone secretos, solo URLs).
export const prerender = false;

export const GET: APIRoute = ({ locals }) => {
  const runtime = (locals as any)?.runtime;
  return new Response(
    JSON.stringify(
      {
        importMetaEnv: import.meta.env.PUBLIC_WPGRAPHQL_URL ?? null,
        runtimeEnv: runtime?.env?.PUBLIC_WPGRAPHQL_URL ?? null,
        hasKv: !!runtime?.env?.WP_CACHE,
        processEnv: (globalThis as any).process?.env?.PUBLIC_WPGRAPHQL_URL ?? null,
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
