const { z } = require('zod');

const mergePullRequestSchema = z.object({
  mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional(),
  commitTitle: z.string().trim().max(255).optional(),
  commitMessage: z.string().trim().max(2000).optional(),
});

module.exports = { mergePullRequestSchema };
