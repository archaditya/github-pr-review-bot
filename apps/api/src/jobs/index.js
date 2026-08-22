const inngest = require('./client');
const reviewPipeline = require('./review-pipeline.job');
const handleCommentReply = require('./handle-comment-reply.job');

const functions = [reviewPipeline, handleCommentReply];

module.exports = { inngest, functions };
