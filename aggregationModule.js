// aggregationModule.js

module.exports = {
    getAggregationPipeline: function (yearFrom, yearTo, topN) {
        return [
            {
                $match: {
                    date: { $gte: new Date(`${yearFrom}-01-01`), $lte: new Date(`${yearTo}-12-31`) },
                },
            },
            {
                $group: {
                    _id: '$movie_id',
                    commentCount: { $sum: 1 },
                },
            },
            {
                $sort: { commentCount: -1 },
            },
            {
                $limit: topN,
            },
        ];
    }
};