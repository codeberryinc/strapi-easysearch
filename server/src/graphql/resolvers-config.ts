const getResolversConfig = () => {
  return {
    'Query.easySearch': {
      auth: false, // Change to true if authentication is required
    },
  };
};

export default getResolversConfig;
