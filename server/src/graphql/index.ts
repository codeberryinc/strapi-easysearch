import { Core } from '@strapi/strapi';

const registerGraphQLQuery = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('✅ Registering EasySearch GraphQL Query...');

  if (!strapi.plugin('graphql')) {
    strapi.log.warn('⚠️ GraphQL plugin is not installed. Skipping EasySearch registration.');
    return;
  }

  const extensionService = strapi.plugin('graphql').service('extension');

  const extension = ({ nexus }: any) => ({
    typeDefs: `
      type SearchResult {
        id: ID!
        title: String
      }

      type SearchResults {
        articles: [SearchResult]
      }

      extend type Query {
        easySearch(query: String!): SearchResults
      }
    `,
    resolvers: {
      Query: {
        easySearch: {
          resolve: async () => {
            return {
              articles: [{ id: '1', title: 'Test Article' }],
            };
          },
        },
      },
    },
    resolversConfig: {
      'Query.easySearch': {
        auth: false, // Allow unauthenticated queries for debugging
      },
    },
  });

  try {
    extensionService.use(extension);
    strapi.log.info('✅ EasySearch GraphQL registered successfully.');
  } catch (error) {
    strapi.log.error(`❌ Failed to register EasySearch GraphQL: ${error.message}`);
  }
};

export default registerGraphQLQuery;
