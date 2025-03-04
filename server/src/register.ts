import type { Core } from '@strapi/strapi';
import getCustomTypes from './graphql/types';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('✅ EasySearch plugin registered!');

  const graphqlPlugin = strapi.plugin('graphql');

  if (!graphqlPlugin) {
    strapi.log.warn('⚠️ GraphQL plugin is not installed. Skipping EasySearch registration.');
    return;
  }

  const extensionService = graphqlPlugin.service('extension');

  const extension = ({ nexus }) => ({
    types: getCustomTypes(strapi, nexus),
    plugins: [nexus.declarativeWrappingPlugin()], // Ensure required Nexus plugin
    resolversConfig: {
      'Query.easySearch': {
        auth: false, // ✅ Allow public access
      },
    },
  });

  try {
    extensionService.use(extension);
    strapi.log.info('✅ EasySearch GraphQL query registered successfully.');
  } catch (error) {
    strapi.log.error(`❌ Failed to register EasySearch GraphQL: ${error.message}`);
  }
};

export default register;
