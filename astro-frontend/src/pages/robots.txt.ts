import type { APIRoute } from 'astro';
import { isIndexable } from '../lib/seo';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const body = isIndexable(url)
    ? `User-agent: *\nDisallow: /carrito\nDisallow: /checkout\nDisallow: /api/\n\nSitemap: ${url.origin}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
