import type { Context } from 'koa';
import type { Core } from '@strapi/strapi';

// Define the expected plugin config structure
interface SearchPluginConfig {
  contentTypes: { uid: string; searchFields: string[] }[];
}

const searchController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async search(ctx: Context) {
    const { query, page = 1, pageSize = 10, populate, fields } = ctx.request.query;

    // Validate the query
    if (!query) {
      return ctx.badRequest('Query parameter is required.');
    }

    // Retrieve the plugin config
    const config = strapi.config.get('plugin::easy-search') as SearchPluginConfig;
    if (!config || !config.contentTypes || config.contentTypes.length === 0) {
      return ctx.notFound('No content types configured for EasySearch.');
    }

    // Call the search service
    const searchService = strapi.plugin('easy-search').service('searchService');
    const { results, total } = await searchService.performSearch(
      query,
      parseInt(page as string),
      parseInt(pageSize as string),
      ctx.state.user
    );

    // Format the REST response dynamically
    const formattedResults = Object.keys(results).reduce(
      (acc, key) => {
        const uid = `api::${key}.${key}`;
        const contentType = config.contentTypes.find((ct) => ct.uid === uid);
        if (!contentType) return acc;

        acc[key] = results[key].map((entry: any) => {
          const response: Record<string, any> = { documentId: entry.documentId };

          if (fields) {
            const selectedFields = (fields as string).split(',');
            selectedFields.forEach((field) => {
              if (entry[field] !== undefined) {
                response[field] = entry[field];
              }
            });
          } else {
            contentType.searchFields.forEach((field) => {
              if (entry[field] !== undefined) {
                response[field] = entry[field];
              }
            });
          }

          if (populate) {
            const populateFields = (populate as string).split(',');

            populateFields.forEach((field) => {
              if (entry[field] !== undefined) {
                if (field === 'featuredMedia' && entry[field]?.image) {
                  response[field] = {
                    image: {
                      url: entry[field].image.url,
                      formats: entry[field].image.formats || null,
                    },
                    video: entry[field]?.video || null,
                  };
                } else {
                  response[field] = entry[field];
                }
              }
            });
          }

          return response;
        });

        return acc;
      },
      {} as Record<string, any>
    );

    // Correct Strapi-compatible Pagination
    const pageCount = Math.ceil(total / Number(pageSize));

    // Return the response matching Strapi's default pagination structure
    ctx.send({
      data: formattedResults,
      meta: {
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          pageCount,
          total,
        },
      },
    });
  },
});

export default searchController;
