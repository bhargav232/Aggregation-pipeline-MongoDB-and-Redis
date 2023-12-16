// redisOperations.js
const { performance } = require('perf_hooks');

async function deleteDataFromRedis(redisClient, movieKey) {
  const startDelete = performance.now();
  await redisClient.del(movieKey);
  const endDelete = performance.now();
  const deleteTime = endDelete - startDelete;

  return { deleteTime };
}

module.exports = {
  deleteDataFromRedis,
};
