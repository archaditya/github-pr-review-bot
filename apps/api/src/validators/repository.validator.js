const { z } = require('zod');

const updateRepositorySchema = z.object({
  isActive: z.boolean(),
});

module.exports = { updateRepositorySchema };
