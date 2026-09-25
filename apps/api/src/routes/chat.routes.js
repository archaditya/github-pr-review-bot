const { Router } = require('express');
const { requireAuth, requireEntitlement } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { chatStreamLimiter } = require('../middlewares/rate-limiters');
const chatController = require('../controllers/chat.controller');
const {
  createSessionSchema,
  sendMessageSchema,
} = require('../validators/chat.validator');

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireEntitlement('can_repo_chat'));

router.post('/sessions', validate(createSessionSchema), chatController.createSession);
router.get('/sessions', chatController.listSessions);
router.get('/sessions/:sessionId', chatController.getSession);
router.delete('/sessions/:sessionId', chatController.deleteSession);
router.post('/sessions/:sessionId/messages', chatStreamLimiter, validate(sendMessageSchema), chatController.sendMessageStream);

module.exports = router;
