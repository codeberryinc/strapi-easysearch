import { transliterate } from 'transliteration';
import fuzzysort from 'fuzzysort';
import type { Core } from '@strapi/strapi';

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
}

const searchService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async performSearch(query: string, page: number, pageSize: number, user: any) {
    const config = strapi.config.get('plugin::easy-search') as SearchPluginConfig;
    if (!config || !config.contentTypes?.length) {
      strapi.log.warn('No content types configured for EasySearch.');
      return { results: {}, total: 0 };
    }

    const results: Record<string, any[]> = {};
    let totalResults = 0;
    const transliteratedQuery = transliterate(query);

    for (const contentTypeConfig of config.contentTypes) {
      const { uid, fuzzysortOptions, transliterate: shouldTransliterate } = contentTypeConfig;
      const contentType = strapi.contentTypes[uid];
      if (!contentType) continue;

      const keys = fuzzysortOptions.keys.map((key) => key.name);
      const availableFields = Object.keys(contentType.attributes);
      const validKeys = keys.filter((key) => availableFields.includes(key));

      const allEntries = await strapi.db.query(contentType.uid).findMany({
        where: { publishedAt: { $notNull: true } },
        populate: true,
      });

      // Apply character limit if configured
      const entriesForSearch = fuzzysortOptions.characterLimit
        ? allEntries.map((entry) => {
            const newEntry = { ...entry };
            validKeys.forEach((key) => {
              if (typeof entry[key] === 'string') {
                newEntry[key] = entry[key].slice(0, fuzzysortOptions.characterLimit);
              } else if (Array.isArray(entry[key])) {
                newEntry[key] = entry[key]
                  .map((item) => extractTextFromJSON(item))
                  .join(' ')
                  .slice(0, fuzzysortOptions.characterLimit);
              }
            });
            return newEntry;
          })
        : allEntries;

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

        fuzzysortOptions.keys.forEach(({ name: field }) => {
          // Apply characterLimit
          if (fuzzysortOptions.characterLimit && processedEntry[field]) {
            processedEntry[field] = processedEntry[field].slice(0, fuzzysortOptions.characterLimit);
          }
        });

        if (shouldTransliterate) {
          processedEntry.transliterated = transliterate(
            fuzzysortOptions.keys.map(({ name: key }) => processedEntry[key] || '').join(' ')
          );
        }

        return processedEntry;
      });

      // Perform fuzzy search on dynamically processed entries
      let fuzzyResults = fuzzysort.go(transliteratedQuery, processedEntries, {
        keys: shouldTransliterate ? [...validKeys, 'transliterated'] : validKeys,
        threshold: fuzzysortOptions.threshold || -10000,
        limit: fuzzysortOptions.limit || 100,
        scoreFn: (result) =>
          Math.max(
            ...fuzzysortOptions.keys.map(
              (key, idx) => (result[idx]?.score || -9999) + (key.weight || 0)
            )
          ),
      });

      // Handle transliteration if enabled
      if (shouldTransliterate) {
        const transliteratedEntries = entriesForSearch.map((entry) => ({
          ...entry,
          transliterations: validKeys.reduce((acc, key) => {
            acc[key] = transliterate(entry[key] || '');
            return acc;
          }, {}),
        }));

        const transliterationKeys = validKeys.map((key) => `transliterations.${key}`);

        const translitResults = fuzzysort.go(transliteratedQuery, transliteratedEntries, {
          keys: transliterationKeys,
          threshold: fuzzysortOptions.threshold || -10000,
          limit: fuzzysortOptions.limit || 100,
          scoreFn: (result) =>
            Math.max(
              ...fuzzysortOptions.keys.map(
                (key, idx) => (result[idx]?.score || -9999) + (key.weight || 0)
              )
            ),
        });

        let mutableFuzzyResults: Fuzzysort.KeysResult<any>[] = [...fuzzyResults];

        translitResults.forEach((transRes) => {
          const originalIdx = mutableFuzzyResults.findIndex(
            (origRes) => origRes.obj.id === transRes.obj.id
          );

          if (originalIdx >= 0 && transRes.score > mutableFuzzyResults[originalIdx].score) {
            mutableFuzzyResults[originalIdx] = transRes;
          } else if (originalIdx === -1) {
            mutableFuzzyResults.push(transRes);
          }
        });

        mutableFuzzyResults.sort((a, b) => b.score - a.score);

        // Explicitly add the `total` property
        const finalResults = mutableFuzzyResults as unknown as Fuzzysort.KeysResults<any>;
        (finalResults as { total: number }).total = mutableFuzzyResults.length;

        fuzzyResults = finalResults;
      }

      // Apply pagination correctly
      const paginatedResults = fuzzyResults
        .slice((page - 1) * pageSize, page * pageSize)
        .map((result) => ({
          ...result.obj,
          highlights: fuzzysortOptions.keys.reduce((acc, key, idx) => {
            if (result[idx]) {
              acc[key.name] = result[idx].highlight('<mark>', '</mark>');
            }
            return acc;
          }, {}),
        }));

      const collectionName = uid.split('::')[1].split('.')[0];
      results[collectionName] = paginatedResults;
      totalResults += fuzzyResults.length;
    }
    // console.log('RESULTS:', results.article[0].highlights);
    return { results, total: totalResults };
  },
});

// Utility to extract plain text from JSON-based rich text
const extractTextFromJSON = (jsonContent: any): string => {
  if (!Array.isArray(jsonContent)) return '';
  return jsonContent
    .map((block) =>
      block.children ? block.children.map((child) => child.text || '').join(' ') : ''
    )
    .join(' ');
};

export default searchService;
