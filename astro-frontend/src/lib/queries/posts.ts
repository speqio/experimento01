// Entradas nativas de WordPress (sin ACF/CPT propio — WPGraphQL las expone de fábrica).
const POST_CARD_FIELDS = /* GraphQL */ `
  id
  databaseId
  title
  slug
  date
  excerpt
  featuredImage { node { sourceUrl altText } }
  categories { nodes { name slug } }
`;

export const GET_POSTS = /* GraphQL */ `
  query GetPosts($first: Int = 12, $after: String) {
    posts(first: $first, after: $after, where: { status: PUBLISH }) {
      nodes { ${POST_CARD_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const GET_POST_BY_SLUG = /* GraphQL */ `
  query GetPostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      ${POST_CARD_FIELDS}
      content
    }
  }
`;
