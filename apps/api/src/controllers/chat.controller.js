const chatService = require('../services/chat.service');

async function createSession(req, res, next) {
  try {
    const { id: repositoryId } = req.params;
    const userId = req.user.id;
    const { title } = req.body;

    const session = await chatService.createSession({ repositoryId, userId, title });
    return res.status(201).json(session);
  } catch (err) {
    return next(err);
  }
}

async function listSessions(req, res, next) {
  try {
    const { id: repositoryId } = req.params;
    const userId = req.user.id;

    const sessions = await chatService.listSessions({ repositoryId, userId });
    return res.json(sessions);
  } catch (err) {
    return next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await chatService.getSessionWithMessages({ sessionId, userId });
    return res.json(session);
  } catch (err) {
    return next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    await chatService.deleteSession({ sessionId, userId });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
}

async function sendMessageStream(req, res, next) {
  try {
    const { id: repositoryId, sessionId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    await chatService.streamMessage({
      repositoryId,
      userId,
      sessionId,
      content,
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      onComplete: (result) => {
        res.write(`data: ${JSON.stringify({ done: true, message: result })}\n\n`);
        res.end();
      },
      onError: (err) => {
        res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
        res.end();
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  sendMessageStream,
};
