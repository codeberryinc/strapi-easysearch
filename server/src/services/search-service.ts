import type { Core } from '@strapi/strapi';

const searchService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async performSearch(
    model: any, // ✅ Add `model` as the first argument
    query: string,
    page: number,
    pageSize: number,
    ctx: any
  ) {
    if (!query) {
      throw new Error('⚠️ Search query cannot be empty.');
    }

    strapi.log.info(`🔍 Searching: "${query}" in ${model.modelName}`);

    // ✅ Create search filters dynamically based on model fields
    const filters = Object.keys(model.attributes)
      .filter((field) => ['string', 'text'].includes(model.attributes[field].type))
      .map((field) => ({ [field]: { $containsi: query } }));

    // ✅ Execute the search query dynamically
    const results = await strapi.db.query(model.uid).findMany({
      where: { $or: filters },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    strapi.log.info(`✅ Found ${results.length} results in ${model.modelName}`);

    return results.map((item: any) => ({
      documentId: item.id,
      ...item,
    }));
  },
});

export default searchService;
