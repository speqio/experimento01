// Entradas nativas de WordPress (WPGraphQL las expone de fábrica, sin ACF ni
// configuración extra) — Astro solo decide el layout/tipografía.
export interface PostCategory {
  name: string;
  slug: string;
}

export interface Post {
  id: string;
  databaseId: number;
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  content?: string;
  featuredImage?: { node: { sourceUrl: string; altText?: string } } | null;
  categories?: { nodes: PostCategory[] };
}
