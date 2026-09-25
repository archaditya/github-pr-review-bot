const { z } = require('zod');

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'pending', 'suspended']),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'user']),
});

const updateUserFeaturesSchema = z.object({
  features: z
    .object({
      can_review_prs: z.boolean().optional(),
      can_repo_chat: z.boolean().optional(),
      can_social_studio: z.boolean().optional(),
      allowed_social_platforms: z
        .array(z.enum(['x', 'linkedin', 'instagram', 'facebook']))
        .optional(),
      social_monthly_quota: z.number().int().min(0).max(10000).optional(),
      ai_provider_mode: z.enum(['byok_only', 'managed']).optional(),
      max_indexed_repos: z.number().int().min(1).max(100).optional(),
    })
    .strict(),
});

module.exports = {
  updateUserStatusSchema,
  updateUserRoleSchema,
  updateUserFeaturesSchema,
};
