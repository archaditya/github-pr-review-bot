const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * X (Twitter) API v2 client for posting tweets.
 * Uses OAuth 1.0a user context via twitter-api-v2 package.
 *
 * X Free tier allows ~280 character tweets. The draft generator is instructed
 * to keep X posts under 280 chars, but this client doesn't enforce a hard limit
 * (the user may edit the text before publishing).
 */

async function getClient() {
  const { apiKey, apiSecret, accessToken, accessSecret } = config.social.x;
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X API credentials not configured — set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET');
  }

  const { TwitterApi } = require('twitter-api-v2');
  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken,
    accessSecret,
  });
}

/**
 * Post a tweet, optionally with an image.
 * @param {Object} params
 * @param {string} params.text - Tweet text
 * @param {string} [params.imageUrl] - URL of image to attach (will be downloaded and uploaded to X)
 * @returns {{ tweetId: string }}
 */
async function postTweet({ text, imageUrl }) {
  const client = await getClient();
  const rwClient = client.readWrite;

  let mediaId;
  if (imageUrl) {
    try {
      let imageBuffer;
      let mimeType = 'image/png';

      if (imageUrl.startsWith('data:')) {
        const mimeMatch = imageUrl.match(/^data:([^;]+);base64,/);
        if (mimeMatch) mimeType = mimeMatch[1];
        const base64Data = imageUrl.replace(/^data:[^;]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const https = require('https');
        const http = require('http');
        const fetch = imageUrl.startsWith('https') ? https : http;

        imageBuffer = await new Promise((resolve, reject) => {
          fetch.get(imageUrl, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
          }).on('error', reject);
        });
      }

      mediaId = await rwClient.v1.uploadMedia(imageBuffer, { mimeType });
    } catch (err) {
      logger.warn({ err: err.message }, 'failed to upload media to X — posting without image');
    }
  }

  const tweetPayload = { text };
  if (mediaId) {
    tweetPayload.media = { media_ids: [mediaId] };
  }

  try {
    const result = await rwClient.v2.tweet(tweetPayload);
    logger.info({ tweetId: result.data.id }, 'tweet posted to X');
    return { tweetId: result.data.id };
  } catch (err) {
    const detail =
      err.data?.detail ||
      err.data?.title ||
      err.errors?.[0]?.message ||
      err.message;
    logger.error(
      { err: detail, code: err.code, status: err.status, data: err.data },
      'failed to post tweet to X',
    );
    throw new Error(`X API (${err.code || err.status || 'error'}): ${detail}`);
  }
}

module.exports = { postTweet };
