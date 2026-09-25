const { z } = require('zod');

const createSessionSchema = z.object({
  title: z.string().trim().max(120).optional(),
});

const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message cannot exceed 4000 characters'),
});

module.exports = {
  createSessionSchema,
  sendMessageSchema,
};
