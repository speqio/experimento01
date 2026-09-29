// Origen del visitante (utm_source/utm_medium/referrer), para la trazabilidad de
// gift cards en wp-admin → Gift Cards → Trazabilidad (ver wordpress/mu-plugins/
// mandala-giftcards-admin.php). Se captura una sola vez por sesión de compra.

const STORAGE_KEY = 'mandala_attribution';

export interface Attribution {
  source: string;
  medium: string;
  campaign: string;
  referrerHost: string;
  landingPage: string;
}

const SOURCE_MAP: Record<string, string> = {
  'google.': 'Búsqueda orgánica',
  'bing.': 'Búsqueda orgánica',
  'duckduckgo.': 'Búsqueda orgánica',
  'facebook.': 'Redes sociales',
  'instagram.': 'Redes sociales',
  'tiktok.': 'Redes sociales',
  'whatsapp.': 'Redes sociales',
  'l.instagram.': 'Redes sociales',
};

function classifyReferrer(host: string): string {
  const match = Object.entries(SOURCE_MAP).find(([k]) => host.includes(k));
  return match ? match[1] : host || 'Directo';
}

/** Se llama una vez por página (BaseLayout); no pisa una atribución ya guardada en la sesión. */
export function captureAttribution(): void {
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source') ?? '';
    const utmMedium = params.get('utm_medium') ?? '';
    const utmCampaign = params.get('utm_campaign') ?? '';

    let referrerHost = '';
    try {
      referrerHost = document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      referrerHost = '';
    }
    // Referrer propio (navegación interna) no cuenta como origen externo.
    if (referrerHost && referrerHost === window.location.hostname) referrerHost = '';

    const source = utmSource || (referrerHost ? classifyReferrer(referrerHost) : 'Directo');

    const attribution: Attribution = {
      source,
      medium: utmMedium,
      campaign: utmCampaign,
      referrerHost,
      landingPage: window.location.pathname,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // sessionStorage bloqueado (modo privado, etc.) — sin atribución, no rompe el flujo.
  }
}

export function getAttribution(): Attribution | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
