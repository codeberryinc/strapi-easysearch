import { transliterate } from 'transliteration';
import fuzzysort from 'fuzzysort';
import type { Core } from '@strapi/strapi';

interface SearchPluginConfig {
  contentTypes: { uid: string; searchFields: string[] }[];
}

const searchService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async performSearch(query: string, page: number, pageSize: number, user: any) {
    strapi.log.info(`🔍 Performing transliterated fuzzy search for: ${query}`);

    const config = strapi.config.get('plugin::easy-search') as SearchPluginConfig | undefined;
    if (!config || !config.contentTypes || config.contentTypes.length === 0) {
      strapi.log.warn('⚠️ No content types configured for EasySearch.');
      return { results: {}, total: 0 };
    }

    const results: Record<string, any[]> = {};
    let totalResults = 0;

    // ✅ Transliterate the search query
    const transliteratedQuery = transliterate(query);
    strapi.log.info(`🔠 Transliterated search query: ${transliteratedQuery}`);

    for (const { uid, searchFields } of config.contentTypes) {
      try {
        const contentType = strapi.contentTypes[uid];
        if (!contentType) {
          strapi.log.warn(`⚠️ Content type "${uid}" not found.`);
          continue;
        }

        strapi.log.info(`📂 Searching in content type: ${uid}`);

        const availableFields = Object.keys(contentType.attributes);
        const validSearchFields = searchFields.filter((field) => availableFields.includes(field));
        if (validSearchFields.length === 0) {
          strapi.log.warn(`⚠️ No valid search fields found for ${uid}. Skipping search.`);
          continue;
        }

        strapi.log.info(
          `🔍 Searching in ${uid} using fields: ${JSON.stringify(validSearchFields)}`
        );

        const allEntries = await strapi.db.query(contentType.uid).findMany({
          where: { publishedAt: { $notNull: true } },
          populate: getPopulateFields(contentType),
        });

        // ✅ Convert rich text JSON fields to searchable text
        const formattedEntries = allEntries.map((entry) => ({
          ...entry,
          content:
            typeof entry.content === 'string' ? entry.content : extractTextFromJSON(entry.content),
          transliterated: transliterate(entry.title + ' ' + extractTextFromJSON(entry.content)), // ✅ Transliterated version of data
        }));

        // ✅ Search both original & transliterated text
        const fuzzyResults = fuzzysort.go(transliteratedQuery, formattedEntries, {
          keys: [...validSearchFields, 'transliterated'], // ✅ Search transliterated text
          threshold: -10000,
          limit: pageSize,
        });

        strapi.log.info(`✅ Found ${fuzzyResults.length} fuzzy matches in ${uid}`);

        const collectionName = uid.split('::')[1].split('.')[0];
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

const getPopulateFields = (contentType: any): string[] => {
  return Object.keys(contentType.attributes).filter((key) =>
    ['relation', 'component', 'media'].includes(contentType.attributes[key].type)
  );
};

export default searchService;
