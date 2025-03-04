import { Core } from '@strapi/strapi';

const getCustomTypes = (strapi: Core.Strapi, nexus: any) => {
  // ✅ Retrieve plugin config dynamically
  const config = strapi.config.get('plugin::easy-search') as
    | { contentTypes: { uid: string }[] }
    | undefined;

  if (!config || !config.contentTypes || config.contentTypes.length === 0) {
    strapi.log.warn('⚠️ No content types configured for EasySearch.');
    return [];
  }

  // ✅ Generate GraphQL type definitions dynamically
  const searchResultTypes = config.contentTypes.map(({ uid }) => {
    const collectionName = uid.split('::')[1].split('.')[0]; // Convert UID format to GraphQL-friendly name
    return { fieldName: collectionName, gqlType: capitalize(collectionName) };
  });

  return [
    // ✅ Define `PageInfo` for consistent pagination format
    nexus.objectType({
      name: 'PageInfo',
      definition(t) {
        t.int('total');
        t.int('page');
        t.int('pageSize');
        t.int('pageCount');
      },
    }),

    // ✅ Define `SearchResults` dynamically with `pageInfo`
    nexus.objectType({
      name: 'SearchResults',
      definition(t) {
        searchResultTypes.forEach(({ fieldName, gqlType }) => {
          t.list.field(fieldName, { type: gqlType });
        });
        t.field('pageInfo', { type: 'PageInfo' });
      },
    }),

    // ✅ Define `Query.easySearch` dynamically
    nexus.extendType({
      type: 'Query',
      definition(t) {
        t.field('easySearch', {
          type: 'SearchResults',
          args: {
            query: nexus.nonNull(nexus.stringArg()),
            page: nexus.intArg({ default: 1 }),
            pageSize: nexus.intArg({ default: 10 }),
          },
          async resolve(_parent, args, context) {
            const strapi = context.strapi || global.strapi;
            if (!strapi) {
              console.error('❌ Strapi instance is missing.');
              throw new Error('Internal Server Error: Strapi instance missing.');
            }

            const searchService = strapi.plugin('easy-search').service('searchService');
            const { results, total } = await searchService.performSearch(
              args.query,
              args.page,
              args.pageSize,
              context
            );

            console.log('🔍 Mapped GraphQL Results:', results);

            // ✅ Ensure pagination metadata is based on unique results
            const pageCount = Math.ceil(total / args.pageSize);

            // ✅ Map the dynamic fields correctly
            const formattedResults = searchResultTypes.reduce(
              (acc, { fieldName }) => {
                acc[fieldName] = results[fieldName] || [];
                return acc;
              },
              {} as Record<string, any[]>
            );

            return {
              ...formattedResults,
              pageInfo: {
                total,
                page: args.page,
                pageSize: args.pageSize,
                pageCount,
              },
            };
          },
        });
      },
    }),
  ];
};

// ✅ Helper function to capitalize field names for GraphQL
const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);

export default getCustomTypes;
