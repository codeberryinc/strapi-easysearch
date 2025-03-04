import type { Core } from '@strapi/strapi';

const searchController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async search(ctx) {
    try {
      strapi.log.info('🌍 Search request received:', ctx.query);

      const { query, page = 1, pageSize = 10 } = ctx.query;
      if (!query || typeof query !== 'string') {
        return ctx.badRequest('Query parameter is required and must be a string.');
      }

      strapi.log.info('🚀 Calling search service with query:', query);

      const searchResults = await strapi
        .plugin('easy-search')
        .service('searchService')
        .performSearch(query, Number(page), Number(pageSize));

      ctx.send({
        data: searchResults,
        meta: { page: Number(page), pageSize: Number(pageSize) },
      });
    } catch (error) {
      strapi.log.error('❌ Search failed:', error);
      ctx.internalServerError('Search failed');
    }
  },
});

export default searchController;
