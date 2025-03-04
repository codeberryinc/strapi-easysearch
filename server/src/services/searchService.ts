import type { Core } from '@strapi/strapi';

// ✅ Define expected plugin config type
interface SearchPluginConfig {
  contentTypes: { uid: string; searchFields: string[] }[];
}

const searchService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async performSearch(query: string, page: number, pageSize: number, user: any) {
    strapi.log.info(`🔍 Performing search for: ${query}`);

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

        // ✅ Construct query filters dynamically
        const searchFilters = validSearchFields.map((field) => ({
          [field]: { $containsi: query },
        }));

        // ✅ Always filter by `publishedAt` when available
        const publicationFilter = contentType.attributes.publishedAt
          ? { publishedAt: { $notNull: true } }
          : {};

        // ✅ Count total matching results (excluding unpublished)
        const totalCount = await strapi.db.query(contentType.uid).count({
          where: { $or: searchFilters, ...publicationFilter },
        });

        // ✅ Fetch paginated results (excluding unpublished)
        const entries = await strapi.db.query(contentType.uid).findMany({
          where: { $or: searchFilters, ...publicationFilter },
          orderBy: { createdAt: 'desc' }, // ✅ Ensure consistent ordering
          limit: pageSize,
          offset: (page - 1) * pageSize,
          populate: getPopulateFields(contentType), // ✅ Dynamic population
        });

        strapi.log.info(`✅ Found ${entries.length} results in ${uid}`);

        // ✅ Convert UID format for GraphQL compatibility
        const collectionName = uid.split('::')[1].split('.')[0];

        // 🔥 **FIX: Ensure Unique Results Using Set**
        results[collectionName] = Array.from(
          new Map(entries.map((item) => [item.id, item])).values()
        );

        totalResults += totalCount;
      } catch (error) {
        strapi.log.error(`❌ Error searching in ${uid}:`, error);
      }
    }

    strapi.log.info('📊 Final Search Results:', JSON.stringify(results, null, 2));

    return { results, total: totalResults };
  },
});

// ✅ Function to dynamically retrieve relation fields for population
const getPopulateFields = (contentType: any): string[] => {
  return Object.keys(contentType.attributes).filter((key) =>
    ['relation', 'component', 'media'].includes(contentType.attributes[key].type)
  );
};

export default searchService;
