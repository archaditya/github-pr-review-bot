const inngest = require('./client');
const reviewPipeline = require('./review-pipeline.job');
const handleCommentReply = require('./handle-comment-reply.job');
const indexRepository = require('./index-repository.job');
const incrementalIndex = require('./incremental-index.job');

const functions = [reviewPipeline, handleCommentReply, indexRepository, incrementalIndex];

module.exports = { inngest, functions };
