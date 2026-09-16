export const GET_SERVICE_BY_SLUG = /* GraphQL */ `
  query GetServiceBySlug($slug: ID!) {
    spaService(id: $slug, idType: SLUG) {
      id
      title
      slug
      content
      featuredImage { node { sourceUrl altText } }
      spaFields {
        durationMinutes
        bodyZone
        intensityLevel
        benefits
        contraindications
        allowGiftCard
      }
      linkedProduct {
        id
        databaseId
        name
        slug
        ... on SimpleProduct { price image { sourceUrl } }
      }
    }
  }
`;

export const GET_SERVICES = /* GraphQL */ `
  query GetServices($first: Int = 24) {
    spaServices(first: $first) {
      nodes {
        id
        title
        slug
        featuredImage { node { sourceUrl altText } }
        spaFields {
          durationMinutes
          bodyZone
          intensityLevel
          allowGiftCard
        }
      }
    }
  }
`;
