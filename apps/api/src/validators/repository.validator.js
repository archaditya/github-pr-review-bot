const { z } = require('zod');

const updateRepositorySchema = z.object({
  isActive: z.boolean().optional(),
  aiReviewEnabled: z.boolean().optional(),
  reviewLevel: z.enum(['balanced', 'strict', 'permissive']).optional(),
  customVoice: z.string().trim().max(500, 'Custom voice cannot exceed 500 characters').nullable().optional(),
});

module.exports = { updateRepositorySchema };
