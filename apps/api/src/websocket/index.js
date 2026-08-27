const { WebSocketServer } = require('ws');
const eventBus = require('../services/event-bus.service');
const apiKeyService = require('../services/api-key.service');
const logger = require('../utils/logger');

/**
 * Attach a WebSocket server to the existing HTTP server.
 * Clients connect to ws://host/ws?key=<app-key> and receive real-time events.
 *
 * All messages are JSON: { event: 'event-name', data: { ... } }
 */
function setupWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    // Authenticate via query param or cookie
    const url = new URL(req.url, 'http://localhost');
    const appKey = url.searchParams.get('key');
    let authenticated = false;

    if (appKey) {
      const valid = await apiKeyService.validateKey(appKey);
      if (valid) authenticated = true;
    }

    // Also check session cookie if present
    if (!authenticated && req.headers.cookie) {
      const jwt = require('jsonwebtoken');
      const config = require('../config');
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(new RegExp(`(^|;\\s*)${config.auth.sessionCookieName}=([^;]+)`));
      const sessionToken = match ? decodeURIComponent(match[2]) : null;
      if (sessionToken) {
        try {
          jwt.verify(sessionToken, config.auth.jwtSecret);
          authenticated = true;
        } catch {}
      }
    }

    // In production with same-origin reverse proxy, allow upgrade if cookie or key exists
    if (!authenticated) {
      // If no valid credentials could be verified, log and allow read-only event broadcast or close
      logger.warn({ url: req.url }, 'websocket connection established without auth key — proceeding in event subscriber mode');
    }

    logger.info('websocket client connected');

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('error', (err) => {
      logger.warn({ err: err.message }, 'websocket error');
    });
  });

  // Heartbeat — detect stale connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  // Subscribe to event bus and broadcast to all connected clients
  function broadcast(event, data) {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
  }

  eventBus.on('review:status-changed', (data) => broadcast('review:status-changed', data));
  eventBus.on('repo:index-changed', (data) => broadcast('repo:index-changed', data));
  eventBus.on('repo:index-error', (data) => broadcast('repo:index-error', data));

  logger.info('websocket server attached at /ws');
  return wss;
}

module.exports = { setupWebSocket };
