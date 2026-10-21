import type { APIRoute } from 'astro';
import { SITE_INFO } from '../lib/siteInfo';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const o = url.origin;
  const body = `# ${SITE_INFO.name}

> Spa en Las Condes, Santiago: masajes, limpiezas faciales, terapias complementarias y tratamientos postoperatorios. Venta de servicios y gift cards en línea con pago Webpay.

## Páginas
- [Tienda de servicios](${o}/tienda): masajes, faciales y tratamientos con precios y duración
- [Promociones](${o}/promociones): servicios con precio rebajado
- [Gift cards](${o}/gift-cards): regalar un servicio o un monto
- [Blog](${o}/blog)
- [Sobre nosotras](${o}/sobre-nosotras)
- [Políticas de la empresa](${o}/politicas-de-la-empresa)
- [Políticas de privacidad](${o}/politicas-de-privacidad)

## Contacto
- Dirección: ${SITE_INFO.address}
- Teléfono: ${SITE_INFO.phone}
- Horario: ${SITE_INFO.schedule}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
