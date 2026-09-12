const { z } = require('zod');

const generateFromPRSchema = z.object({
  pullRequestId: z.string().uuid(),
});

const imageUrlValidator = z
  .string()
  .refine(
    (val) => val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
    { message: 'Must be a valid URL or image data URL' },
  );

const generateStandaloneSchema = z.object({
  input: z.string().min(1).max(5000),
  repoContext: z.string().max(100).optional(),
  imageUrl: imageUrlValidator.optional(),
});

const updateDraftSchema = z.object({
  editedText: z.string().max(5000).optional(),
  imageUrl: imageUrlValidator.nullable().optional(),
});

const publishAllSchema = z.object({
  postIds: z.array(z.string().uuid()).min(1).max(10),
});

module.exports = {
  generateFromPRSchema,
  generateStandaloneSchema,
  updateDraftSchema,
  publishAllSchema,
};
