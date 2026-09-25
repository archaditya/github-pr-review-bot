const { z } = require('zod');

const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(64, 'Name cannot exceed 64 characters'),
});

module.exports = { createApiKeySchema };
