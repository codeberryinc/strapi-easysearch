export default {
  'content-api': {
    type: 'content-api',
    routes: [
      {
        method: 'GET',
        path: '/search',
        handler: 'searchController.search',
        config: {
          policies: [],
        },
      },
    ],
  },
};
