import { transliterate } from 'transliteration';
import fuzzysort from 'fuzzysort';
import type { Core } from '@strapi/strapi';

// ✅ Define the expected plugin config structure
interface SearchPluginConfig {
  contentTypes: { uid: string; searchFields: string[] }[];
}

const searchService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async performSearch(query: string, page: number, pageSize: number, user: any) {
    strapi.log.info(
      `🔍 Performing transliterated fuzzy search for: "${query}" (Page: ${page}, PageSize: ${pageSize})`
    );

    const config = strapi.config.get('plugin::easy-search') as SearchPluginConfig | undefined;
    if (!config || !config.contentTypes || config.contentTypes.length === 0) {
      strapi.log.warn('⚠️ No content types configured for EasySearch.');
      return { results: {}, total: 0 };
    }

    const results: Record<string, any[]> = {};
    let totalResults = 0;

    // ✅ Transliterate the query for fuzzy searching
    const transliteratedQuery = transliterate(query);
    strapi.log.info(`🔠 Transliterated search query: "${transliteratedQuery}"`);

    for (const { uid, searchFields } of config.contentTypes) {
      try {
        const contentType = strapi.contentTypes[uid];
        if (!contentType) {
          strapi.log.warn(`⚠️ Content type "${uid}" not found.`);
          continue;
        }

        strapi.log.info(`📂 Searching in: ${uid}`);

        // ✅ Get valid search fields from schema
        const availableFields = Object.keys(contentType.attributes);
        const validSearchFields = searchFields.filter((field) => availableFields.includes(field));
        if (validSearchFields.length === 0) {
          strapi.log.warn(`⚠️ No valid search fields found for ${uid}. Skipping.`);
          continue;
        }

        strapi.log.info(`🔍 Using fields: ${JSON.stringify(validSearchFields)}`);

        // ✅ Fetch all published entries
        const allEntries = await strapi.db.query(contentType.uid).findMany({
          where: { publishedAt: { $notNull: true } },
          populate: getPopulateFields(contentType),
        });

        // ✅ Process each entry to make JSON fields searchable
        const processedEntries = allEntries.map((entry) => ({
          ...entry,
          content: extractTextFromJSON(entry.content), // Convert JSON rich text
          transliterated: transliterate(entry.title + ' ' + extractTextFromJSON(entry.content)), // Transliteration of text
        }));

        // ✅ Apply fuzzy search
        const fuzzyResults = fuzzysort.go(transliteratedQuery, processedEntries, {
          keys: [...validSearchFields, 'transliterated'], // Include both original & transliterated fields
          threshold: -10000, // Lower threshold to match more results
          limit: 1000, // Retrieve **all matches**, pagination applied **afterwards**
        });

        // ✅ Correct Pagination: Apply after fuzzy search (instead of limiting early)
        const paginatedResults = fuzzyResults
          .slice((page - 1) * pageSize, page * pageSize)
          .map((r) => r.obj);

        strapi.log.info(
          `✅ Found ${fuzzyResults.length} total matches in ${uid}. Showing ${paginatedResults.length} for page ${page}.`
        );

        const collectionName = uid.split('::')[1].split('.')[0];
        results[collectionName] = paginatedResults;
        totalResults += fuzzyResults.length; // ✅ Ensure total count includes **all matches**
      } catch (error) {
        strapi.log.error(`❌ Error searching in ${uid}:`, error);
      }
    }

    strapi.log.info('📊 Final Fuzzy Search Results:', JSON.stringify(results, null, 2));

    return { results, total: totalResults }; // ✅ Ensure total count is from **all** matches
  },
});

/**
 * ✅ Extracts text content from JSON-based rich text (Strapi RTE format)
 */
const extractTextFromJSON = (jsonContent: any): string => {
  if (!Array.isArray(jsonContent)) return '';
  return jsonContent
    .map((block) => {
      if (block.children) {
        return block.children.map((child) => (child.text ? child.text : '')).join(' ');
      }
      return '';
    })
    .join(' ');
};

/**
 * ✅ Automatically populates relations & media fields
 */
const getPopulateFields = (contentType: any): string[] => {
  return Object.keys(contentType.attributes).filter((key) =>
    ['relation', 'component', 'media'].includes(contentType.attributes[key].type)
  );
};

export default searchService;
