const { z } = require('zod');

const generateFromPRSchema = z.object({
  pullRequestId: z.string().uuid(),
});

const generateStandaloneSchema = z.object({
  input: z.string().min(1).max(2000),
  repoContext: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
});

const updateDraftSchema = z.object({
  editedText: z.string().max(5000).optional(),
  imageUrl: z.string().url().nullable().optional(),
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
