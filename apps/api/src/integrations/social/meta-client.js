const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../utils/logger');

const META_GRAPH_BASE = 'https://graph.facebook.com/v20.0';
const MEDIA_DIR = process.env.MEDIA_CACHE_DIR || '/tmp/pr-review-media';

/**
 * Ensures an image URL is a publicly accessible HTTPS URL.
 * If given a base64 data URI, saves it to disk and serves it from this API's /api/media route.
 */
function ensurePublicImageUrl(imageUrl) {
  if (!imageUrl) return null;

  if (imageUrl.startsWith('data:image/')) {
    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }

    const base64Data = imageUrl.replace(/^data:image\/[^;]+;base64,/, '');
    const hash = crypto.createHash('sha256').update(base64Data).digest('hex').slice(0, 16);
    const filename = `${hash}.png`;
    const filePath = path.join(MEDIA_DIR, filename);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    }

    const baseUrl = config.webAppUrl || 'https://pr-review-bot.archadi.dev';
    return `${baseUrl}/api/media/${filename}`;
  }

  return imageUrl;
}

/**
 * Get Meta credentials and validate they are set.
 */
function getMetaConfig() {
  const { pageAccessToken, pageId, instagramAccountId } = config.social.meta;
  return { pageAccessToken, pageId, instagramAccountId };
}

/**
 * Publish a post to a Facebook Page (with or without image).
 * @param {Object} params
 * @param {string} params.text - Post caption / text
 * @param {string} [params.imageUrl] - Image URL or base64 data URI
 * @returns {Promise<{ postId: string }>}
 */
async function postToFacebookPage({ text, imageUrl }) {
  const { pageAccessToken, pageId } = getMetaConfig();
  if (!pageAccessToken || !pageId) {
    throw new Error('Meta credentials not configured — set META_PAGE_ACCESS_TOKEN and META_PAGE_ID');
  }

  const publicImageUrl = ensurePublicImageUrl(imageUrl);

  if (publicImageUrl) {
    logger.info({ pageId }, 'publishing photo post to Facebook Page');
    const res = await axios.post(
      `${META_GRAPH_BASE}/${pageId}/photos`,
      {
        url: publicImageUrl,
        caption: text,
        access_token: pageAccessToken,
      },
      { timeout: 30000 }
    );
    return { postId: res.data.post_id || res.data.id };
  }

  logger.info({ pageId }, 'publishing text post to Facebook Page');
  const res = await axios.post(
    `${META_GRAPH_BASE}/${pageId}/feed`,
    {
      message: text,
      access_token: pageAccessToken,
    },
    { timeout: 30000 }
  );
  return { postId: res.data.id };
}

/**
 * Publish a post to an Instagram Business / Creator account.
 * Instagram API requires an image and uses a 2-step media container flow.
 * @param {Object} params
 * @param {string} params.caption - Instagram caption with hashtags
 * @param {string} params.imageUrl - Public image URL or base64 data URI
 * @returns {Promise<{ postId: string }>}
 */
async function postToInstagram({ caption, imageUrl }) {
  const { pageAccessToken, instagramAccountId } = getMetaConfig();
  if (!pageAccessToken || !instagramAccountId) {
    throw new Error('Instagram credentials not configured — set META_PAGE_ACCESS_TOKEN and META_INSTAGRAM_ACCOUNT_ID');
  }

  const publicImageUrl = ensurePublicImageUrl(imageUrl);
  if (!publicImageUrl) {
    throw new Error('Instagram requires an image for feed posts. Generate or attach an image before publishing.');
  }

  logger.info({ instagramAccountId }, 'creating Instagram media container');

  // Step 1: Create media container
  const containerRes = await axios.post(
    `${META_GRAPH_BASE}/${instagramAccountId}/media`,
    {
      image_url: publicImageUrl,
      caption: caption || '',
      access_token: pageAccessToken,
    },
    { timeout: 30000 }
  );

  const containerId = containerRes.data.id;
  if (!containerId) {
    throw new Error('Failed to create Instagram media container — no container ID returned');
  }

  // Brief pause to allow Meta's crawler to download and process the image
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 2: Publish media container
  logger.info({ instagramAccountId, containerId }, 'publishing Instagram media container');
  const publishRes = await axios.post(
    `${META_GRAPH_BASE}/${instagramAccountId}/media_publish`,
    {
      creation_id: containerId,
      access_token: pageAccessToken,
    },
    { timeout: 30000 }
  );

  return { postId: publishRes.data.id };
}

module.exports = {
  postToFacebookPage,
  postToInstagram,
  ensurePublicImageUrl,
};
