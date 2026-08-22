const inngest = require('./client');
const db = require('../models');
const config = require('../config');
const aiService = require('../integrations/ai-service-client');
const githubComments = require('../integrations/github/comment-client');

/**
 * Triggered by `pr/comment.received` (emitted from services/webhook.service.js when
 * services/conversation.service.js's @mention rule matches — ADR-009). Builds context
 * from the original review's findings + the message history so far, generates a reply
 * via ai-service (still fully stateless — ADR-003), and posts it.
 */
const handleCommentReply = inngest.createFunction(
  { id: 'handle-comment-reply', retries: 3 },
  { event: 'pr/comment.received' },
  async ({ event, step }) => {
    const { reviewJobId, installationId, owner, repo, pullNumber } = event.data;

    const context = await step.run('load-context', async () => {
      const reviewJob = await db.ReviewJob.findByPk(reviewJobId, {
        include: [
          { model: db.ReviewComment, as: 'summaryComment' },
          { model: db.ConversationMessage, as: 'conversationMessages' },
        ],
        order: [[{ model: db.ConversationMessage, as: 'conversationMessages' }, 'createdAt', 'ASC']],
      });

      if (!reviewJob) throw new Error(`ReviewJob ${reviewJobId} not found`);

      return {
        findings: reviewJob.summaryComment?.findings || [],
        messages: (reviewJob.conversationMessages || []).map((m) => ({
          author: m.authorType,
          body: m.body,
        })),
      };
    });

    const reply = await step.run('generate-reply', async () => {
      const result = await aiService.generateConversationReply({
        findings: context.findings,
        message_history: context.messages,
      });
      return result.reply;
    });

    await step.run('post-reply', async () => {
      const posted = await githubComments.postReplyComment({
        installationId,
        owner,
        repo,
        pullNumber,
        body: reply,
      });

      await db.ConversationMessage.create({
        reviewJobId,
        githubCommentId: posted.id,
        authorType: db.ConversationMessage.AUTHOR_TYPES.BOT,
        authorLogin: config.github.botHandle,
        body: reply,
      });
    });

    return { reviewJobId };
  },
);

module.exports = handleCommentReply;
