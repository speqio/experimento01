// Banners editables desde wp-admin → Banners (ver wordpress/mu-plugins/mandala-banners.php).
export const GET_SITE_BANNER = /* GraphQL */ `
  query GetSiteBanner($key: String!) {
    siteBanner(key: $key) {
      image
      eyebrow
      title
      description
      primaryText
      primaryLink
      secondaryText
      secondaryLink
    }
  }
`;
