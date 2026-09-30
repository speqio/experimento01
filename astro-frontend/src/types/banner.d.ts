// Banner editable desde wp-admin → Banners (wordpress/mu-plugins/mandala-banners.php).
// Cualquier campo puede venir vacío: la página que lo consume cae a su contenido
// de fábrica cuando no está configurado.
export interface SiteBanner {
  image: string | null;
  eyebrow: string | null;
  title: string | null;
  description: string | null;
  primaryText: string | null;
  primaryLink: string | null;
  secondaryText: string | null;
  secondaryLink: string | null;
}
