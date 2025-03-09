import { transliterate } from "transliteration";
import fuzzysort from "fuzzysort";
import type { Core } from "@strapi/strapi";

interface SearchPluginConfig {
  contentTypes: {
    uid: string;
    transliterate?: boolean;
    fuzzysortOptions: {
      characterLimit?: number;
      threshold?: number;
      limit?: number;
      keys: { name: string; weight?: number }[];
    };
  }[];
  searchApproach: "pre-filtering" | "fuzzysort" | "hybrid";
}

const searchService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async performSearch(
    query: string,
    page: number,
    pageSize: number,
    user: any,
  ) {
    const config = strapi.config.get(
      "plugin::easy-search",
    ) as SearchPluginConfig;
    const searchApproach = config.searchApproach || "hybrid"; // Default to hybrid approach

    if (!config || !config.contentTypes?.length) {
      strapi.log.warn("❌ No content types configured for EasySearch.");
      return { results: {}, pageInfo: {} };
    }

    const results: Record<string, any[]> = {};
    const pageInfo: Record<string, any> = {};
    const transliteratedQuery = transliterate(query);

    for (const contentTypeConfig of config.contentTypes) {
      const {
        uid,
        fuzzysortOptions,
        transliterate: shouldTransliterate,
      } = contentTypeConfig;
      const contentType = strapi.contentTypes[uid];
      if (!contentType) {
        strapi.log.warn(`⚠️ Content type "${uid}" not found.`);
        continue;
      }

      const keys = fuzzysortOptions.keys.map((key) => key.name); // Get dynamic keys
      const availableFields = Object.keys(contentType.attributes);
      const validKeys = keys.filter((key) => availableFields.includes(key)); // Filter valid keys

      let allEntries: any[] = [];

      if (searchApproach === "pre-filtering" || searchApproach === "hybrid") {
        // Create a dynamic `$or` condition for database filtering based on valid keys
        const orConditions = validKeys.map((key) => ({
          [key]: { $containsi: transliteratedQuery },
        }));

        allEntries = await strapi.db.query(contentType.uid).findMany({
          where: {
            publishedAt: { $notNull: true }, // Only include published entries
            $or: orConditions, // Dynamic filtering based on keys
          },
          limit: searchApproach === "pre-filtering" ? pageSize * 10 : undefined,
          populate: true,
        });
      } else {
        // Fetch all entries if no pre-filtering is applied
        allEntries = await strapi.db.query(contentType.uid).findMany({
          where: { publishedAt: { $notNull: true } },
          populate: true,
        });
      }

      if (!allEntries.length) {
        strapi.log.warn(`⚠️ No entries found for "${uid}".`);
        continue;
      }

      const processedEntries = allEntries.map((entry) => {
        const processedEntry = { ...entry };

        // Process fields (e.g., rich text fields)
        Object.keys(entry).forEach((field) => {
          const attribute = contentType.attributes[field];
          if (attribute?.type === "blocks" || attribute?.type === "text") {
            processedEntry[field] = extractTextFromJSON(entry[field]);
          }
        });

        // Truncate fields based on character limit
        fuzzysortOptions.keys.forEach(({ name: field }) => {
          if (typeof processedEntry[field] === "string") {
            processedEntry[field] = processedEntry[field].slice(
              0,
              fuzzysortOptions.characterLimit || 500,
            );
          }
        });

        if (shouldTransliterate) {
          processedEntry.transliterated = transliterate(
            fuzzysortOptions.keys
              .map(({ name: key }) => processedEntry[key] || "")
              .join(" "),
          );
        }

        return processedEntry;
      });

      const fuzzyResults =
        searchApproach === "pre-filtering"
          ? processedEntries // Skip Fuzzysort if pre-filtering is used exclusively
          : fuzzysort.go(transliteratedQuery, processedEntries, {
              keys: shouldTransliterate
                ? [...validKeys, "transliterated"]
                : validKeys,
              threshold: fuzzysortOptions.threshold || -10000,
              limit: fuzzysortOptions.limit || 100,
              scoreFn: (result) =>
                Math.max(
                  ...fuzzysortOptions.keys.map(
                    (key, idx) =>
                      (result[idx]?.score || -9999) + (key.weight || 0),
                  ),
                ),
            });

      const totalResults =
        searchApproach === "pre-filtering"
          ? allEntries.length
          : fuzzyResults.length;
      const paginatedResults = fuzzyResults
        .slice((page - 1) * pageSize, page * pageSize)
        .map((result) =>
          searchApproach === "pre-filtering"
            ? result
            : {
                ...result.obj,
                highlights: fuzzysortOptions.keys.reduce((acc, key, idx) => {
                  if (result[idx]) {
                    acc[key.name] = result[idx].highlight("<mark>", "</mark>");
                  }
                  return acc;
                }, {}),
              },
        );

      const collectionName = uid.split("::")[1].split(".")[0];
      results[collectionName] = paginatedResults;

      pageInfo[collectionName] = {
        page,
        pageCount: Math.ceil(totalResults / pageSize),
        pageSize,
        total: totalResults,
      };
    }

    return { results, pageInfo };
  },
});

// Utility to extract plain text from JSON-based rich text
const extractTextFromJSON = (jsonContent: any): string => {
  if (!Array.isArray(jsonContent)) return "";
  return jsonContent
    .map((block) =>
      block.children
        ? block.children.map((child) => child.text || "").join(" ")
        : "",
    )
    .join(" ");
};

export default searchService;
