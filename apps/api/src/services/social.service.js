const db = require('../models');
const config = require('../config');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const githubPr = require('../integrations/github/pull-request-client');
const aiService = require('../integrations/ai-service-client');
const xClient = require('../integrations/social/x-client');
const linkedinClient = require('../integrations/social/linkedin-client');
const metaClient = require('../integrations/social/meta-client');
const repositoryService = require('./repository.service');
const settingsService = require('./settings.service');
const logger = require('../utils/logger');

const SUPPORTED_PLATFORMS = ['x', 'linkedin', 'instagram', 'facebook'];

function getDraftForPlatform(drafts, platform) {
  switch (platform) {
    case 'x':
      return drafts.x_draft;
    case 'linkedin':
      return drafts.linkedin_draft;
    case 'instagram':
      return drafts.instagram_draft || drafts.x_draft;
    case 'facebook':
      return drafts.facebook_draft || drafts.linkedin_draft;
    default:
      return '';
  }
}

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
  if (pr.repository.customVoice) {
    voice.tone = pr.repository.customVoice;
  }
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

  let userKey = null;
  if (installation?.installedByUserId) {
    userKey = await settingsService.getDecryptedOpenAiKey(installation.installedByUserId);
  }
  if (!userKey) {
    userKey = process.env.OPENAI_API_KEY || null;
  }

  // Call AI service to generate drafts focused on features & implementation
  const drafts = await aiService.generateSocialDrafts({
    diff: diff.slice(0, 15000), // generous diff of what was actually built
    review_summary: '', // omitted so post focuses on features, not bot review findings
    findings: [],       // omitted so post focuses on features, not bot review findings
    repo_name: voice.name,
    repo_voice: voice.tone,
    pr_title: pr.title,
    pr_number: pr.githubPrNumber,
    changed_files: changedFiles.map((f) => f.filename || f.file).slice(0, 25),
    author: pr.authorLogin,
    openai_api_key: userKey,
  });

  // Image URL is generated by ai-service via DALL·E 3
  const imageUrl = drafts.image_url || drafts.imageUrl || null;

  // Upsert social posts (one per platform)
  const posts = [];
  for (const platform of SUPPORTED_PLATFORMS) {
    const draftText = getDraftForPlatform(drafts, platform);

    const [post] = await db.SocialPost.findOrCreate({
      where: { pullRequestId, platform },
      defaults: {
        draftText,
        imageUrl,
        status: 'draft',
      },
    });

    // If post already existed (re-generate), update the draft and image
    if (post.draftText !== draftText || post.imageUrl !== imageUrl) {
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

  const user = await db.User.findByPk(userId);
  const userKey = await settingsService.getDecryptedOpenAiKey(userId);
  if (!userKey) {
    throw new ValidationError(
      'An OpenAI API key is required. Please configure your personal OpenAI API Key under Settings > AI Engine (BYOK).'
    );
  }

  // Enforce monthly quota for non-admin users
  if (user && user.role !== 'admin') {
    const quota = user.features?.social_monthly_quota ?? 20;
    const currentUsage = user.usage?.post_count || 0;
    if (quota > 0 && currentUsage >= quota) {
      throw new ValidationError(
        `Monthly social post quota of ${quota} reached. Please contact admin to increase your limit.`
      );
    }
  }

  const drafts = await aiService.generateSocialDrafts({
    diff: '',
    review_summary: '',
    findings: [],
    repo_name: voice.name,
    repo_voice: voice.tone,
    pr_title: '',
    pr_number: 0,
    changed_files: [],
    author: user?.name || 'Aditya',
    standalone_input: input,
    openai_api_key: userKey,
  });

  const finalImageUrl = imageUrl || drafts.image_url || drafts.imageUrl || null;

  const allowedPlatforms = user?.features?.allowed_social_platforms || SUPPORTED_PLATFORMS;
  const targetPlatforms = SUPPORTED_PLATFORMS.filter((p) => allowedPlatforms.includes(p));
  const platformsToCreate = targetPlatforms.length > 0 ? targetPlatforms : SUPPORTED_PLATFORMS;

  const posts = [];
  for (const platform of platformsToCreate) {
    const draftText = getDraftForPlatform(drafts, platform);
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
      let postUrl = null;
      if (post.platform === 'x') {
        const result = await xClient.postTweet({ text, imageUrl: post.imageUrl });
        postUrl = result.tweetId ? `https://x.com/i/status/${result.tweetId}` : null;
        await post.update({
          status: 'published',
          publishedAt: new Date(),
          externalPostId: result.tweetId,
          postUrl,
          error: null,
        });
      } else if (post.platform === 'linkedin') {
        const result = await linkedinClient.postArticle({ text, imageUrl: post.imageUrl });
        postUrl = result.postUrn ? `https://www.linkedin.com/feed/update/${result.postUrn}` : null;
        await post.update({
          status: 'published',
          publishedAt: new Date(),
          externalPostId: result.postUrn,
          postUrl,
          error: null,
        });
      } else if (post.platform === 'facebook') {
        const result = await metaClient.postToFacebookPage({ text, imageUrl: post.imageUrl });
        postUrl = result.postId ? `https://facebook.com/${result.postId}` : null;
        await post.update({
          status: 'published',
          publishedAt: new Date(),
          externalPostId: result.postId,
          postUrl,
          error: null,
        });
      } else if (post.platform === 'instagram') {
        const result = await metaClient.postToInstagram({ caption: text, imageUrl: post.imageUrl });
        postUrl = result.permalink || (result.postId ? `https://www.instagram.com/p/${result.postId}/` : null);
        await post.update({
          status: 'published',
          publishedAt: new Date(),
          externalPostId: result.postId,
          postUrl,
          error: null,
        });
      }
      results.push({ id: post.id, platform: post.platform, status: 'published', postUrl });
    } catch (err) {
      logger.error({ err: err.message, postId: post.id, platform: post.platform }, 'failed to publish social post');
      await post.update({ status: 'failed', error: err.message });
      results.push({ id: post.id, platform: post.platform, status: 'failed', error: err.message });
    }
  }

  // Increment usage count for non-admin user
  if (userId) {
    try {
      const user = await db.User.findByPk(userId);
      const publishedCount = results.filter((r) => r.status === 'published').length;
      if (user && user.role !== 'admin' && publishedCount > 0) {
        const currentCount = user.usage?.post_count || 0;
        await user.update({
          usage: {
            ...(user.usage || {}),
            post_count: currentCount + publishedCount,
          },
        });
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'failed to update user post usage count');
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
