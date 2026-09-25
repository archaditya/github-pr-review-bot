const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rate-limiters');

const router = Router();

router.get('/github/login', authLimiter, authController.login);
router.get('/github/callback', authLimiter, authController.callback);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;
