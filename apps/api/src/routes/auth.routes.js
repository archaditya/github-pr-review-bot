const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const requireAuth = require('../middlewares/auth.middleware');

const router = Router();

router.get('/github/login', authController.login);
router.get('/github/callback', authController.callback);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;
