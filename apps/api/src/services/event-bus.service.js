const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * Internal event bus — bridges service-layer state changes to WebSocket broadcasts.
 * Services emit events here; the WebSocket server subscribes and pushes to connected clients.
 *
 * Events emitted:
 *   - review:status-changed  { reviewJobId, status, step, detail }
 *   - repo:index-changed     { repositoryId, indexStatus, fileCount, symbolCount }
 *   - repo:index-error       { repositoryId, error }
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitReviewStatusChange(data) {
    this.emit('review:status-changed', data);
    logger.debug({ event: 'review:status-changed', ...data }, 'event bus');
  }

  emitIndexStatusChange(data) {
    this.emit('repo:index-changed', data);
    logger.debug({ event: 'repo:index-changed', ...data }, 'event bus');
  }

  emitIndexError(data) {
    this.emit('repo:index-error', data);
    logger.debug({ event: 'repo:index-error', ...data }, 'event bus');
  }
}

// Singleton — shared across the entire API process
const eventBus = new EventBus();

module.exports = eventBus;
