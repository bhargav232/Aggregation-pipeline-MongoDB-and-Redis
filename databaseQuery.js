// databaseOperations.js
const { performance } = require('perf_hooks');

async function executeQuery(collection, aggregationPipeline) {
  const startQuery = performance.now();
  const aggregationResult = await collection.aggregate(aggregationPipeline).toArray();
  const endQuery = performance.now();
  const queryTime = endQuery - startQuery;

  return { queryTime, aggregationResult };
}

module.exports = {
  executeQuery,
};
