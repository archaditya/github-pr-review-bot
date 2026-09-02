const { Router } = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const chatController = require('../controllers/chat.controller');

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/sessions', chatController.createSession);
router.get('/sessions', chatController.listSessions);
router.get('/sessions/:sessionId', chatController.getSession);
router.delete('/sessions/:sessionId', chatController.deleteSession);
router.post('/sessions/:sessionId/messages', chatController.sendMessageStream);

module.exports = router;
