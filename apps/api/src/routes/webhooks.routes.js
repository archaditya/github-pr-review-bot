const { Router } = require('express');
const verifyGithubWebhook = require('../middlewares/verify-github-webhook.middleware');
const webhooksController = require('../controllers/webhooks.controller');

const router = Router();

router.post('/github', verifyGithubWebhook, webhooksController.handleGithubWebhook);

module.exports = router;
