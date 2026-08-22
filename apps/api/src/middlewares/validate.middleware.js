const { ValidationError } = require('../utils/errors');

/**
 * Validates req[part] (default: 'body') against a zod schema, replacing it with the
 * parsed (and coerced/defaulted) value on success. Throws ValidationError on failure,
 * which the centralized error handler maps to a 400 with field-level details.
 *
 * Usage: router.post('/repos', validate(createRepoSchema), controller.create)
 */
function validate(schema, part = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ValidationError('Request validation failed', details));
    }

    req[part] = result.data;
    return next();
  };
}

module.exports = validate;
