
// npx mocha performance-test.js\ use this command in terminal for output results


const { getAggregationPipeline } = require('./aggregationModule');
const { calculateAverage, calculatePercentile } = require('./Performance');
const { executeQuery } = require('./databaseQuery');
const { performance } = require('perf_hooks');
const assert = require('assert');
const { MongoClient } = require('mongodb');
const Redis = require('ioredis');

const dotenv = require('dotenv');
dotenv.config();

const mongoUri = process.env.MONGO_URI;
const mongoClient = new MongoClient(mongoUri);

// Endpoint details for Redis Labs
const redisConfig = {
    password: process.env.REDIS_PASSWORD,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
};
const redisClient = new Redis(redisConfig);

async function replicateData() {
    try {
        await mongoClient.connect();

        const databaseName = 'sample_mflix';
        const collectionName = 'comments';

        const database = mongoClient.db(databaseName);
        const collection = database.collection(collectionName);

        // Specify the top-N value (adjust as needed)
        const yearFrom = 2000;
        const yearTo = 2009;
        const topN = 10;

        const movieKey = `top-${topN}-${yearFrom}-${yearTo}`;

        const redisResult = await redisClient.get(movieKey);

        if (!redisResult) {
            const aggregationPipeline = getAggregationPipeline(yearFrom, yearTo, topN);
            const { queryTime, aggregationResult } = await executeQuery(collection, aggregationPipeline);
            const { deleteTime } = await deleteDataFromRedis(movieKey);

            // Store the result in Redis with the specific key
            await redisClient.set(movieKey, JSON.stringify(aggregationResult));

            console.log(`Query time for Iteration: ${queryTime} ms`);
            console.log(`Deletion time for Iteration: ${deleteTime} ms`);
        }
    } catch (error) {
        console.error('Error in replicateData:', error);
    } finally {
        // Close MongoDB connection
        // Uncomment the next line if you want to close the MongoDB connection after each Iteration
        // await mongoClient.close();
    }
}

async function deleteDataFromRedis(movieKey) {
    const startDelete = performance.now();
    await redisClient.del(movieKey);
    const endDelete = performance.now();
    const deleteTime = endDelete - startDelete;

    return { deleteTime };
}

describe('Performance Test', function () {
    const Iteration = 100;
    const yearFrom = 2000;
    const yearTo = 2009;
    const topN = 10;

    it('should measure performance when Redis is empty', async function () {
        const responseTimes = [];
        let redisResult; // Variable to store Redis result

        for (let i = 0; i < Iteration; i++) {
            console.log(`Iteration ${i + 1} for Redis empty test`);
            await clearRedis();
            const start = performance.now();
            await replicateData();
            const end = performance.now();
            const elapsedTime = end - start;
            responseTimes.push(elapsedTime);

            if (Iteration == 1) {
                console.log('Connected to MongoDB');
            }

            if (i === Iteration - 1) {
                // Skip delete operation in the last Iteration
                redisResult = await redisClient.get(`top-${topN}-${yearFrom}-${yearTo}`);
                console.log('Data from Redis(Redis empty test):', JSON.parse(redisResult));
                break;
            }
        }

        logPerformanceStats('Redis empty', responseTimes);
        assert.ok(true);
    }).timeout(60000);

    it('should measure performance when Redis contains data', async function () {
        // First, populate Redis with data
        await replicateData();

        const responseTimes = [];
        let redisResult; // Variable to store Redis result

        for (let i = 0; i < Iteration; i++) {
            console.log(`Iteration ${i + 1} for Redis contains data test`);
            const start = performance.now();
            await replicateData();
            const end = performance.now();
            const elapsedTime = end - start;
            responseTimes.push(elapsedTime);

            if (Iteration == 1) {
                console.log('Connected to MongoDB');
            }

            if (i === Iteration - 1) {
                redisResult = await redisClient.get(`top-${topN}-${yearFrom}-${yearTo}`);
                console.log(`$ Data from Redis(Redis contains data) for top-${topN}-${yearFrom}-${yearTo}:`, JSON.parse(redisResult));
            }
        }

        logPerformanceStats('Redis contains data', responseTimes);
        assert.ok(true);
    }).timeout(60000);

    async function clearRedis() {
        const movieKey = `top-${topN}-${yearFrom}-${yearTo}`;
        await redisClient.del(movieKey);
    }

    async function logPerformanceStats(testType, responseTimes) {
        const averageTime = calculateAverage(responseTimes);
        const percentile50 = calculatePercentile(responseTimes, 50);
        const percentile90 = calculatePercentile(responseTimes, 90);

        console.log(`Average time for ${testType} test: ${averageTime} ms`);
        console.log(`50th percentile time: ${percentile50} ms`);
        console.log(`90th percentile time: ${percentile90} ms`);

        // Fetch and print the final result from Redis
        const finalResult = await redisClient.get(`top-${topN}-${yearFrom}-${yearTo}`);
        console.log(`Final result from Redis for ${movieKey}:`, JSON.parse(finalResult));
    }
});
