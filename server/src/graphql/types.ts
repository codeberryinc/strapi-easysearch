import { Core } from "@strapi/strapi";

const getCustomTypes = (strapi: Core.Strapi, nexus: any) => {
  const config = strapi.config.get("plugin::easy-search") as
    | { contentTypes: { uid: string }[] }
    | undefined;

  if (!config || !config.contentTypes || config.contentTypes.length === 0) {
    strapi.log.warn("⚠️ No content types configured for EasySearch.");
    return [];
  }

  // Map configured content types to GraphQL field names and types
  const searchResultTypes = config.contentTypes.map(({ uid }) => {
    const collectionName = uid.split("::")[1].split(".")[0]; // Extract collection name
    return { fieldName: collectionName, gqlType: capitalize(collectionName) };
  });

  return [
    // Define dynamic per-dataset pagination information
    nexus.objectType({
      name: "DatasetPageInfo",
      definition(t) {
        t.int("total"); // Total results for the dataset
        t.int("page"); // Current page
        t.int("pageSize"); // Results per page
        t.int("pageCount"); // Total pages
      },
    }),

    // Define the overall PageInfo object dynamically
    nexus.objectType({
      name: "PageInfo",
      definition(t) {
        searchResultTypes.forEach(({ fieldName }) => {
          t.field(fieldName, { type: "DatasetPageInfo" }); // Add per-dataset pagination dynamically
        });
      },
    }),

    // Define the results structure for all datasets
    nexus.objectType({
      name: "SearchResults",
      definition(t) {
        searchResultTypes.forEach(({ fieldName, gqlType }) => {
          t.list.field(fieldName, { type: gqlType }); // Dynamic results fields
        });
        t.field("pageInfo", { type: "PageInfo" }); // Dynamic pageInfo structure
      },
    }),

    // Extend the Query type to include the dynamic easySearch query
    nexus.extendType({
      type: "Query",
      definition(t) {
        t.field("easySearch", {
          type: "SearchResults",
          args: {
            query: nexus.nonNull(nexus.stringArg()), // Required query string
            page: nexus.intArg({ default: 1 }), // Optional page, defaults to 1
            pageSize: nexus.intArg({ default: 10 }), // Optional pageSize, defaults to 10
          },
          async resolve(_parent, args, context) {
            const strapi = context.strapi || global.strapi;
            if (!strapi) {
              console.error("❌ Strapi instance is missing.");
              throw new Error(
                "Internal Server Error: Strapi instance missing.",
              );
            }

            const searchService = strapi
              .plugin("easy-search")
              .service("searchService");
            const { results, pageInfo } = await searchService.performSearch(
              args.query,
              args.page,
              args.pageSize,
              context.state.user,
            );

            // Build formatted results and pagination metadata dynamically
            const formattedResults = searchResultTypes.reduce(
              (acc, { fieldName }) => {
                acc[fieldName] = results[fieldName] || [];
                return acc;
              },
              {} as Record<string, any[]>,
            );

            return {
              ...formattedResults,
              pageInfo, // Include per-dataset pagination metadata
            };
          },
        });
      },
    }),
  ];
};

// Helper to capitalize the first letter of a string
const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

export default getCustomTypes;
