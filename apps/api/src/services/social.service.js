const db = require('../models');
const config = require('../config');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const githubPr = require('../integrations/github/pull-request-client');
const aiService = require('../integrations/ai-service-client');
const socialImageService = require('./social-image.service');
const xClient = require('../integrations/social/x-client');
const linkedinClient = require('../integrations/social/linkedin-client');
const repositoryService = require('./repository.service');
const logger = require('../utils/logger');

/**
 * Per-repo tone/voice mapping. Each project gets its own personality for social posts.
 * Key = substring of fullName (case-insensitive match). Falls back to 'default'.
 */
const REPO_VOICE = {
  bytevault: {
    name: 'ByteVault',
    tone: 'A cloud-based file management platform — professional, product-focused, feature-oriented',
  },
  'bytevault-fe': {
    name: 'ByteVault',
    tone: 'A cloud-based file management platform (frontend) — UI/UX-focused, design-aware',
  },
  verkin: {
    name: 'Verkin',
    tone: 'A social media platform — community-driven, social, engaging, startup energy',
  },
  'course-bot': {
    name: 'Course Bot',
    tone: 'An AI-powered educational assistant — knowledge-sharing, educational, helpful',
  },
  'github-pr-review-bot': {
    name: 'PR Review Bot',
    tone: 'An AI code review automation tool — developer tooling, DevOps, engineering excellence',
  },
  'vps-infra-configs': {
    name: 'Infrastructure',
    tone: 'Server infrastructure and DevOps configurations — infrastructure, reliability, operations',
  },
  default: {
    name: 'Project',
    tone: 'Software engineering — technical, professional, developer-focused',
  },
};

function getRepoVoice(fullName) {
  if (!fullName) return REPO_VOICE.default;
  const lower = fullName.toLowerCase();
  for (const [key, voice] of Object.entries(REPO_VOICE)) {
    if (key !== 'default' && lower.includes(key)) return voice;
  }
  return REPO_VOICE.default;
}

/**
 * Generate social post drafts from a PR's context.
 * Creates two SocialPost rows (x + linkedin) with status=draft.
 */
async function generateFromPR(userId, pullRequestId) {
  const pr = await db.PullRequest.findByPk(pullRequestId, {
    include: [
      {
        model: db.Repository,
        as: 'repository',
        include: [{ model: db.Installation, as: 'installation' }],
      },
      {
        model: db.ReviewJob,
        as: 'reviewJobs',
        include: [{ model: db.ReviewComment, as: 'summaryComment' }],
        order: [['createdAt', 'DESC']],
        limit: 1,
      },
    ],
  });

  if (!pr) throw new NotFoundError('Pull request not found');
  await repositoryService.getForUser(userId, pr.repository.id);

  const voice = getRepoVoice(pr.repository.fullName);
  const latestJob = pr.reviewJobs?.[0];
  const findings = latestJob?.summaryComment?.findings || [];
  const reviewSummary = latestJob?.summaryComment?.body || '';

  // Fetch diff context for the AI
  const installation = pr.repository.installation;
  const [owner, repo] = pr.repository.fullName.split('/');
  let diff = '';
  let changedFiles = [];
  try {
    const diffData = await githubPr.getPullRequestDiff({
      installationId: installation.githubInstallationId,
      owner,
      repo,
      pullNumber: pr.githubPrNumber,
    });
    diff = typeof diffData === 'string' ? diffData : '';
    changedFiles = await githubPr.listChangedFiles({
      installationId: installation.githubInstallationId,
      owner,
      repo,
      pullNumber: pr.githubPrNumber,
    });
  } catch (err) {
    logger.warn({ err: err.message, pullRequestId }, 'failed to fetch diff for social post — proceeding with review summary only');
  }

  // Call AI service to generate drafts
  const drafts = await aiService.generateSocialDrafts({
    diff: diff.slice(0, 8000), // cap to avoid token explosion
    review_summary: reviewSummary,
    findings: findings.slice(0, 10),
    repo_name: voice.name,
    repo_voice: voice.tone,
    pr_title: pr.title,
    pr_number: pr.githubPrNumber,
    changed_files: changedFiles.map((f) => f.filename || f.file).slice(0, 20),
    author: pr.authorLogin,
  });

  // Generate image via DALL·E
  let imageUrl = null;
  try {
    imageUrl = await socialImageService.generatePostImage({
      prTitle: pr.title,
      repoName: voice.name,
      repoVoice: voice.tone,
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'DALL·E image generation failed — post will have no image');
  }

  // Upsert social posts (one per platform)
  const posts = [];
  for (const platform of ['x', 'linkedin']) {
    const draftText = platform === 'x' ? drafts.x_draft : drafts.linkedin_draft;

    const [post] = await db.SocialPost.findOrCreate({
      where: { pullRequestId, platform },
      defaults: {
        draftText,
        imageUrl,
        status: 'draft',
      },
    });

    // If post already existed (re-generate), update the draft
    if (post.draftText !== draftText) {
      await post.update({ draftText, imageUrl, status: 'draft', editedText: null, error: null });
    }

    posts.push(post);
  }

  return posts;
}

/**
 * Generate social post drafts from a standalone idea (not PR-triggered).
 */
async function generateStandalone(userId, { input, repoContext, imageUrl }) {
  const voice = repoContext ? getRepoVoice(repoContext) : REPO_VOICE.default;

  const drafts = await aiService.generateSocialDrafts({
    diff: '',
    review_summary: '',
    findings: [],
    repo_name: voice.name,
    repo_voice: voice.tone,
    pr_title: '',
    pr_number: 0,
    changed_files: [],
    author: 'Aditya',
    standalone_input: input,
  });

  // Generate image if none provided
  let finalImageUrl = imageUrl || null;
  if (!finalImageUrl) {
    try {
      finalImageUrl = await socialImageService.generatePostImage({
        prTitle: input.slice(0, 100),
        repoName: voice.name,
        repoVoice: voice.tone,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'DALL·E image generation failed for standalone post');
    }
  }

  const posts = [];
  for (const platform of ['x', 'linkedin']) {
    const draftText = platform === 'x' ? drafts.x_draft : drafts.linkedin_draft;
    const post = await db.SocialPost.create({
      platform,
      draftText,
      imageUrl: finalImageUrl,
      status: 'draft',
      standaloneInput: input,
      repoContext: repoContext || null,
    });
    posts.push(post);
  }

  return posts;
}

/**
 * Get social posts for a PR.
 */
async function getPostsForPR(userId, pullRequestId) {
  const pr = await db.PullRequest.findByPk(pullRequestId, {
    include: [{ model: db.Repository, as: 'repository' }],
  });
  if (!pr) throw new NotFoundError('Pull request not found');
  await repositoryService.getForUser(userId, pr.repository.id);

  return db.SocialPost.findAll({
    where: { pullRequestId },
    order: [['platform', 'ASC']],
  });
}

/**
 * List recent social posts (for the Create Post page).
 */
async function listRecent({ limit = 20, cursor } = {}) {
  const { Op } = require('sequelize');
  const where = cursor ? { createdAt: { [Op.lt]: new Date(cursor) } } : {};

  return db.SocialPost.findAll({
    where,
    include: [
      {
        model: db.PullRequest,
        as: 'pullRequest',
        required: false,
        attributes: ['id', 'githubPrNumber', 'title'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
  });
}

/**
 * Update a social post's edited text or image.
 */
async function updateDraft(userId, socialPostId, { editedText, imageUrl }) {
  const post = await db.SocialPost.findByPk(socialPostId);
  if (!post) throw new NotFoundError('Social post not found');

  const patch = {};
  if (editedText !== undefined) patch.editedText = editedText;
  if (imageUrl !== undefined) patch.imageUrl = imageUrl;

  await post.update(patch);
  return post;
}

/**
 * Publish both posts (X + LinkedIn) for a given set of post IDs.
 * Publishes to each platform independently — one failure doesn't block the other.
 */
async function publishAll(userId, postIds) {
  const posts = await db.SocialPost.findAll({
    where: { id: postIds },
  });

  if (posts.length === 0) throw new NotFoundError('No social posts found');

  const results = [];

  for (const post of posts) {
    const text = post.editedText || post.draftText;
    try {
      if (post.platform === 'x') {
        const result = await xClient.postTweet({ text, imageUrl: post.imageUrl });
        await post.update({
          status: 'published',
          publishedAt: new Date(),
          externalPostId: result.tweetId,
          error: null,
        });
      } else if (post.platform === 'linkedin') {
        const result = await linkedinClient.postArticle({ text, imageUrl: post.imageUrl });
        await post.update({
          status: 'published',
          publishedAt: new Date(),
          externalPostId: result.postUrn,
          error: null,
        });
      }
      results.push({ id: post.id, platform: post.platform, status: 'published' });
    } catch (err) {
      logger.error({ err: err.message, postId: post.id, platform: post.platform }, 'failed to publish social post');
      await post.update({ status: 'failed', error: err.message });
      results.push({ id: post.id, platform: post.platform, status: 'failed', error: err.message });
    }
  }

  return results;
}

/**
 * Publish a single social post.
 */
async function publishPost(userId, socialPostId) {
  return publishAll(userId, [socialPostId]);
}

module.exports = {
  generateFromPR,
  generateStandalone,
  getPostsForPR,
  listRecent,
  updateDraft,
  publishAll,
  publishPost,
  getRepoVoice,
  REPO_VOICE,
};
