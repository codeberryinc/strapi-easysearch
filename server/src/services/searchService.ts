import { transliterate } from 'transliteration';
import fuzzysort from 'fuzzysort';
import type { Core } from '@strapi/strapi';

// ✅ Define the expected plugin config structure
interface SearchPluginConfig {
  contentTypes: { uid: string; searchFields: string[] }[];
}

const searchService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async performSearch(query: string, page: number, pageSize: number, user: any) {
    const config = strapi.config.get('plugin::easy-search') as SearchPluginConfig | undefined;
    if (!config || !config.contentTypes || config.contentTypes.length === 0) {
      strapi.log.warn('⚠️ No content types configured for EasySearch.');
      return { results: {}, total: 0 };
    }

    const results: Record<string, any[]> = {};
    let totalResults = 0;

    // ✅ Transliterate the query for fuzzy searching
    const transliteratedQuery = transliterate(query);

    for (const { uid, searchFields } of config.contentTypes) {
      try {
        const contentType = strapi.contentTypes[uid];
        if (!contentType) {
          strapi.log.warn(`⚠️ Content type "${uid}" not found.`);
          continue;
        }

        // ✅ Get valid search fields from schema
        const availableFields = Object.keys(contentType.attributes);
        const validSearchFields = searchFields.filter((field) => availableFields.includes(field));
        if (validSearchFields.length === 0) {
          strapi.log.warn(`⚠️ No valid search fields found for ${uid}. Skipping.`);
          continue;
        }

        // ✅ Fetch all published entries with explicit deep population
        const allEntries = await strapi.db.query(contentType.uid).findMany({
          where: { publishedAt: { $notNull: true } },
          populate: getDeepPopulateFields(contentType), // ✅ Use dynamic deep population
        });

        // ✅ Process each entry to make JSON fields searchable
        const processedEntries = allEntries.map((entry) => {
          const processedEntry = { ...entry };

          // ✅ Iterate over the entry fields and process rich text fields
          Object.keys(entry).forEach((field) => {
            const attribute = contentType.attributes[field];

            // ✅ Convert only `richtext` or `text` fields (Markdown is usually `text`)
            if (attribute?.type === 'blocks' || attribute?.type === 'text') {
              processedEntry[field] = extractTextFromJSON(entry[field]);
            }
          });

          // ✅ Transliteration should also be dynamic based on found fields
          processedEntry.transliterated = transliterate(
            [entry.title, ...Object.values(processedEntry)].join(' ')
          );

          return processedEntry;
        });

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

        const collectionName = uid.split('::')[1].split('.')[0];
        results[collectionName] = paginatedResults;
        totalResults += fuzzyResults.length; // Ensure total count includes **all matches**
      } catch (error) {
        strapi.log.error(`❌ Error searching in ${uid}:`, error);
      }
    }

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
 * Dynamically populates all relations, components, and media fields
 */
const getDeepPopulateFields = (contentType: any): Record<string, any> => {
  const populate: Record<string, any> = {};

  Object.keys(contentType.attributes).forEach((key) => {
    const attribute = contentType.attributes[key];

    if (attribute.type === 'relation' || attribute.type === 'component') {
      // Recursively populate relations & components
      populate[key] = { populate: true };
    } else if (attribute.type === 'media') {
      // Dynamically detect media fields (image, video, etc.)
      populate[key] = {
        populate: detectNestedMediaFields(attribute),
      };
    }
  });

  return populate;
};

/**
 * Detects and returns all nested media attributes dynamically
 */
const detectNestedMediaFields = (mediaAttribute: any): Record<string, any> => {
  if (!mediaAttribute || !mediaAttribute.allowedTypes) return {}; // Return empty object for full population

  const nestedFields: Record<string, any> = {};
  mediaAttribute.allowedTypes.forEach((type: string) => {
    nestedFields[type] = true; // Populate all nested media types dynamically
  });

  return nestedFields;
};

export default searchService;
