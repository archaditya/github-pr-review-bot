const { Router } = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const mergeController = require('../controllers/merge.controller');

const router = Router();

router.use(requireAuth);

// Merge a PR via the GitHub App credentials
router.post('/:id/merge', mergeController.mergePullRequest);

module.exports = router;
