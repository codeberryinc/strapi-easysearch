import type { Context } from 'koa';
import type { Core } from '@strapi/strapi';

// Define the expected plugin config structure
interface SearchPluginConfig {
  contentTypes: {
    uid: string;
    transliterate: boolean;
    fuzzysortOptions: {
      characterLimit: number;
      threshold: number;
      limit: number;
      keys: { name: string; weight: number }[];
    };
  }[];
}

const searchController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async search(ctx: Context) {
    const { query, page = 1, pageSize = 10, populate, fields } = ctx.request.query;

    // Validate the query
    if (!query) {
      return ctx.badRequest('Query parameter is required.');
    }

    // Retrieve plugin config dynamically
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
    const formattedResults = await Promise.all(
      Object.keys(results).map(async (key) => {
        const uid = `api::${key}.${key}`;
        const contentType = strapi.contentTypes[uid];
        if (!contentType) return { [key]: [] };

        const populatedEntries = await Promise.all(
          results[key].map(async (entry: any) => {
            const response: Record<string, any> = { id: entry.id };

            // Dynamically include requested fields
            if (fields) {
              const selectedFields = (fields as string).split(',');
              selectedFields.forEach((field) => {
                if (entry[field] !== undefined) {
                  response[field] = entry[field];
                }
              });
            } else {
              // Include all attributes dynamically if no `fields` parameter
              Object.keys(contentType.attributes).forEach((field) => {
                if (entry[field] !== undefined) {
                  response[field] = entry[field];
                }
              });
            }

            // Dynamically populate relations and media
            if (populate) {
              const populateParams = parseAdvancedPopulate(populate);

              const fullEntry = await strapi.db.query(uid).findOne({
                where: { id: entry.id },
                populate: populateParams,
              });

              // Add populated fields to the response dynamically
              Object.keys(populateParams).forEach((field) => {
                if (fullEntry && fullEntry[field] !== undefined) {
                  // Handle specific nested filtering logic for fields like `image.url`
                  if (field === 'featuredMedia' && fullEntry[field]) {
                    response[field] = {
                      ...fullEntry[field],
                      image: fullEntry[field].image
                        ? { url: fullEntry[field].image.url } // Extract only the `url` field
                        : null,
                    };
                  } else {
                    response[field] = fullEntry[field];
                  }
                }
              });
            }

            return response;
          })
        );

        return { [key]: populatedEntries };
      })
    ).then((resultsArray) => Object.assign({}, ...resultsArray));

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

// Dynamic helper to parse complex populate parameters
const parseAdvancedPopulate = (populate: any): Record<string, any> => {
  if (typeof populate === 'string') {
    return populate.split(',').reduce((acc: Record<string, any>, field: string) => {
      const keys = field.split('[').map((key) => key.replace(']', ''));
      let currentLevel = acc;
      keys.forEach((key, index) => {
        if (!currentLevel[key]) {
          currentLevel[key] = index === keys.length - 1 ? true : {};
        }
        currentLevel = currentLevel[key];
      });
      return acc;
    }, {});
  }
  return populate;
};

export default searchController;
