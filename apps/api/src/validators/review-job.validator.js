const { z } = require('zod');

const listReviewJobsQuerySchema = z.object({
  repositoryId: z.string().uuid(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().datetime().optional(),
});

module.exports = { listReviewJobsQuerySchema };
