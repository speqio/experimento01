// Información editorial fija del spa (no viene de WooCommerce/WPGraphQL).
export const SITE_INFO = {
  name: 'Mándala Spa',
  legalName: 'Spa Mandala', // nombre de empresa en Yoast (datos estructurados)
  streetAddress: 'Presidente Errázuriz 2933, Oficina B',
  logo: '/gift-card-logo.png', // ponytail: reemplazar por el logo en alta y una imagen social de 1200x630 cuando lleguen
  whatsapp: '56992242180',
  phone: '+56 9 9224 2180',
  email: 'contacto@spamandala.cl', // comercial
  legalEmail: 'administracion@spamandala.cl', // privacidad y temas legales
  address: 'Las Condes, Santiago, Chile',
  instagram: 'https://instagram.com/spamandala',
  facebook: 'https://facebook.com/spamandala',
  schedule: 'Lun a Vie 10:00 - 19:00 hrs · Sáb 10:00 - 15:30 hrs',
  // Mismo horario en formato estructurado (sobre-nosotras y el JSON-LD de LocalBusiness).
  hours: [
    { label: 'Lunes a viernes', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '19:00' },
    { label: 'Sábado', days: ['Saturday'], opens: '10:00', closes: '15:30' },
  ],
};

// Contenedor de laboratorio.space (clon de producción). Cambiar a GTM-M5SFR549 en el corte.
export const GTM_CONTAINER_ID = 'GTM-MLTN686R';

export const RESERVO_URL ='https://agendamiento.reservo.cl/makereserva/agenda/h0iYsYc0h0mkkT2Y0E606nC2p3k4Km';
