const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

/**
 * LinkedIn API client for posting to personal profile.
 * Uses REST API directly (no SDK needed) with w_member_social scope.
 */

function getHeaders() {
  const { accessToken } = config.social.linkedin;
  if (!accessToken) {
    throw new Error('LINKEDIN_ACCESS_TOKEN not configured');
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

function getPersonUrn() {
  const { personUrn } = config.social.linkedin;
  if (!personUrn) {
    throw new Error('LINKEDIN_PERSON_URN not configured — set it to your LinkedIn person URN (e.g. urn:li:person:XXXXX)');
  }
  return personUrn;
}

/**
 * Upload an image to LinkedIn for use in a share.
 * @param {string} imageUrl - URL of the image to upload
 * @returns {string} The asset URN for the uploaded image
 */
async function uploadImage(imageUrl) {
  const personUrn = getPersonUrn();
  const headers = getHeaders();

  // Step 1: Register image upload
  const registerResponse = await axios.post(
    `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
    {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    },
    { headers },
  );

  const uploadUrl =
    registerResponse.data.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl;
  const asset = registerResponse.data.value.asset;

  // Step 2: Download image from URL
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });

  // Step 3: Upload image binary to LinkedIn
  await axios.put(uploadUrl, imageResponse.data, {
    headers: {
      ...headers,
      'Content-Type': 'image/png',
    },
  });

  logger.info({ asset }, 'image uploaded to LinkedIn');
  return asset;
}

/**
 * Post a share to the authenticated user's LinkedIn profile.
 * @param {Object} params
 * @param {string} params.text - Post text
 * @param {string} [params.imageUrl] - Optional image URL to attach
 * @returns {{ postUrn: string }}
 */
async function postArticle({ text, imageUrl }) {
  const personUrn = getPersonUrn();
  const headers = getHeaders();

  const shareBody = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  // Attach image if provided
  if (imageUrl) {
    try {
      const imageAsset = await uploadImage(imageUrl);
      shareBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      shareBody.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          status: 'READY',
          media: imageAsset,
        },
      ];
    } catch (err) {
      logger.warn({ err: err.message }, 'failed to upload image to LinkedIn — posting without image');
    }
  }

  const response = await axios.post(`${LINKEDIN_API_BASE}/ugcPosts`, shareBody, { headers });

  const postUrn = response.headers['x-restli-id'] || response.data.id || '';
  logger.info({ postUrn }, 'article posted to LinkedIn');
  return { postUrn };
}

module.exports = { postArticle, uploadImage };
