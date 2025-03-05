import type { Core } from '@strapi/strapi';
import fuzzysort from 'fuzzysort';

// ✅ Define expected plugin config type
interface SearchPluginConfig {
  contentTypes: { uid: string; searchFields: string[] }[];
}

const searchService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async performSearch(query: string, page: number, pageSize: number, user: any) {
    strapi.log.info(`🔍 Performing fuzzy search for: ${query}`);

    // ✅ Retrieve plugin config dynamically
    const config = strapi.config.get('plugin::easy-search') as SearchPluginConfig | undefined;
    if (!config || !config.contentTypes || config.contentTypes.length === 0) {
      strapi.log.warn('⚠️ No content types configured for EasySearch.');
      return { results: {}, total: 0 };
    }

    const results: Record<string, any[]> = {};
    let totalResults = 0;

    for (const { uid, searchFields } of config.contentTypes) {
      try {
        const contentType = strapi.contentTypes[uid];
        if (!contentType) {
          strapi.log.warn(`⚠️ Content type "${uid}" not found.`);
          continue;
        }

        strapi.log.info(`📂 Searching in content type: ${uid}`);

        // ✅ Validate fields exist in schema
        const availableFields = Object.keys(contentType.attributes);
        const validSearchFields = searchFields.filter((field) => availableFields.includes(field));
        if (validSearchFields.length === 0) {
          strapi.log.warn(`⚠️ No valid search fields found for ${uid}. Skipping search.`);
          continue;
        }

        strapi.log.info(
          `🔍 Searching in ${uid} using fields: ${JSON.stringify(validSearchFields)}`
        );

        // ✅ Fetch all records (since Fuzzysort works in-memory)
        const allEntries = await strapi.db.query(contentType.uid).findMany({
          where: { publishedAt: { $notNull: true } }, // Only get published records
          populate: getPopulateFields(contentType), // Ensure nested relations are retrieved
        });

        // ✅ Convert rich text JSON fields to searchable text
        const formattedEntries = allEntries.map((entry) => ({
          ...entry,
          content:
            typeof entry.content === 'string' ? entry.content : extractTextFromJSON(entry.content),
        }));

        // ✅ Apply Fuzzysort search in-memory
        const fuzzyResults = fuzzysort.go(query, formattedEntries, {
          keys: validSearchFields,
          threshold: -10000,
          limit: pageSize,
        });

        strapi.log.info(`✅ Found ${fuzzyResults.length} fuzzy matches in ${uid}`);

        // ✅ Convert UID format for GraphQL compatibility
        const collectionName = uid.split('::')[1].split('.')[0];

        // 🔥 **Transform results back to normal structure**
        results[collectionName] = fuzzyResults.map((result) => result.obj);
        totalResults += fuzzyResults.length;
      } catch (error) {
        strapi.log.error(`❌ Error searching in ${uid}:`, error);
      }
    }

    strapi.log.info('📊 Final Fuzzy Search Results:', JSON.stringify(results, null, 2));

    return { results, total: totalResults };
  },
});

// ✅ Helper function: Extract text from Strapi rich text JSON
const extractTextFromJSON = (jsonContent: any): string => {
  if (!Array.isArray(jsonContent)) return ''; // Ensure it's an array

  return jsonContent
    .map((block) => {
      if (block.children) {
        return block.children
          .map((child) => (child.text ? child.text : '')) // Extract text
          .join(' ');
      }
      return '';
    })
    .join(' '); // Join all extracted text into a single string
};

// ✅ Function to dynamically retrieve relation fields for population
const getPopulateFields = (contentType: any): string[] => {
  return Object.keys(contentType.attributes).filter((key) =>
    ['relation', 'component', 'media'].includes(contentType.attributes[key].type)
  );
};

export default searchService;
