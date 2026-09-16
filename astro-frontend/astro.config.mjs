import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// Modo híbrido: SSG por defecto (catálogo/blog), SSR opt-in por página
// (carrito, checkout, /api/*) vía `export const prerender = false`.
export default defineConfig({
  output: 'hybrid',
  adapter: cloudflare({
    imageService: 'compile',
  }),
  integrations: [react(), tailwind()],
});
