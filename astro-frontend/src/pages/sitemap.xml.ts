import type { APIRoute } from 'astro';
import { wpQuery, kvCacheFrom } from '../lib/wp-graphql';
import { STATIC_PATHS } from '../lib/seo';
import pages from '../data/paginas-wp.json';

export const prerender = false;

const QUERY = /* GraphQL */ `
  query SitemapNodes {
    products(first: 500, where: { status: "publish" }) { nodes { slug modified } }
    posts(first: 500, where: { status: PUBLISH }) { nodes { slug modified } }
    productCategories(first: 100, where: { hideEmpty: true }) { nodes { slug parent { node { slug } } } }
  }
`;

type Node = { slug: string; modified?: string | null };
type Cat = { slug: string; parent?: { node: { slug: string } } | null };

export const GET: APIRoute = async (ctx) => {
  const { origin } = ctx.url;
  let products: Node[] = [];
  let posts: Node[] = [];
  let cats: Cat[] = [];
  try {
    const data = await wpQuery<{ products: { nodes: Node[] }; posts: { nodes: Node[] }; productCategories: { nodes: Cat[] } }>({
      query: QUERY,
      cache: kvCacheFrom(ctx),
    });
    products = data.products.nodes;
    posts = data.posts.nodes;
    cats = data.productCategories.nodes;
  } catch {
    // Sin WordPress se publica al menos el sitemap de páginas fijas.
  }

  const entry = (path: string, modified?: string | null) =>
    `<url><loc>${origin}${path}</loc>${modified ? `<lastmod>${modified.slice(0, 10)}</lastmod>` : ''}</url>`;
  const urls = [
    ...STATIC_PATHS.map((p) => entry(p)),
    ...pages.map((p) => entry(`/${p.path}/`)),
    ...cats.map((c) => entry(`/categoria-producto/${c.parent ? c.parent.node.slug + "/" : ""}${c.slug}/`)),
    ...products.map((p) => entry(`/producto/${p.slug}/`, p.modified)),
    ...posts.map((p) => entry(`/blog/${p.slug}`, p.modified)),
  ];

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } },
  );
};
