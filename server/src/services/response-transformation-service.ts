import { ContentType } from '../interfaces/interfaces';

const buildGraphqlResponse = (
  results: any[],
  contentType: ContentType,
  auth: any,
  pagination: { start: number; limit: number }
) => {
  // Transform results into the format expected by GraphQL
  return {
    data: results.map((result) => ({
      id: result.documentId,
      attributes: result,
    })),
    meta: {
      pagination: {
        start: pagination.start,
        limit: pagination.limit,
        total: results.length,
      },
    },
  };
};

export { buildGraphqlResponse };
