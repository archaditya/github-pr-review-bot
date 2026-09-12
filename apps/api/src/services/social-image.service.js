const config = require('../config');
const logger = require('../utils/logger');

/**
 * Generate a post image using OpenAI DALL·E.
 * Returns the image URL from OpenAI's CDN (temporary — should be downloaded and stored).
 */
async function generatePostImage({ prTitle, repoName, repoVoice }) {
  const apiKey = config.social.openaiApiKey;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured — cannot generate images');
  }

  const prompt = [
    `Create a modern, minimal, professional social media post image for a software engineering update.`,
    `Project: "${repoName}".`,
    `Context: ${repoVoice}.`,
    `Topic: "${prTitle}".`,
    `Style: Clean gradient background, abstract geometric shapes suggesting code/technology,`,
    `modern sans-serif typography feel. No text in the image — just visual design.`,
    `Colors: Rich, vibrant, tech-forward palette. Professional and premium quality.`,
    `Aspect ratio: Landscape (16:9).`,
  ].join(' ');

  // Dynamic import for ESM-only openai package
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey });

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1792x1024', // closest to 16:9 DALL·E supports
    quality: 'standard',
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) {
    throw new Error('DALL·E returned no image URL');
  }

  logger.info({ repoName, prTitle: prTitle.slice(0, 50) }, 'DALL·E image generated');
  return imageUrl;
}

module.exports = { generatePostImage };
