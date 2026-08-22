/**
 * Base class for all operational errors — errors we anticipate and want mapped to a
 * clean HTTP response (as opposed to unexpected bugs, which the error handler treats
 * as 500s without leaking internals). See middlewares/error-handler.middleware.js.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid request', details = undefined) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Thrown by the ai-service-client's circuit breaker when the breaker is open or the
 * call times out (ADR-006). Caught by the calling service and mapped to a
 * ReviewJob.status = RETRYING / FAILED transition — never leaked as a raw 500.
 */
class AiServiceUnavailableError extends AppError {
  constructor(message = 'AI service is temporarily unavailable') {
    super(message, 503, 'AI_SERVICE_UNAVAILABLE');
  }
}

/**
 * Thrown when a Sequelize model's guarded state-machine setter (e.g. ReviewJob.status)
 * rejects an invalid transition (docs/architecture/data-model.md).
 */
class InvalidStateTransitionError extends AppError {
  constructor(message = 'Invalid state transition') {
    super(message, 409, 'INVALID_STATE_TRANSITION');
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  AiServiceUnavailableError,
  InvalidStateTransitionError,
};
