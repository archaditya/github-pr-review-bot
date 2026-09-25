const { z } = require('zod');

const saveAiKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, 'API key is too short')
    .max(250, 'API key is too long')
    .regex(/^sk-/, 'Invalid OpenAI key format (must start with sk-)'),
});

const testAiKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, 'API key is too short')
    .max(250, 'API key is too long')
    .regex(/^sk-/, 'Invalid OpenAI key format (must start with sk-)')
    .optional(),
});

const updatePreferencesSchema = z.object({
  preferences: z.record(z.any()).optional(),
  allowedSocialPlatforms: z
    .array(z.enum(['x', 'linkedin', 'instagram', 'facebook']))
    .optional(),
});

module.exports = {
  saveAiKeySchema,
  testAiKeySchema,
  updatePreferencesSchema,
};
