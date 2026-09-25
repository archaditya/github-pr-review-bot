const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const mergeController = require('../controllers/merge.controller');
const { mergePullRequestSchema } = require('../validators/merge.validator');

const router = Router();

router.use(requireAuth);

// Merge a PR via the GitHub App credentials
router.post('/:id/merge', validate(mergePullRequestSchema), mergeController.mergePullRequest);

module.exports = router;
