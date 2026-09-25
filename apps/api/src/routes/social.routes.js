const { requireAuth, requireEntitlement } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const socialController = require('../controllers/social.controller');
const {
  generateFromPRSchema,
  generateStandaloneSchema,
  updateDraftSchema,
  publishAllSchema,
} = require('../validators/social.validator');

const router = Router();

router.use(requireAuth);
router.use(requireEntitlement('can_social_studio'));

// PR-triggered draft generation
router.post('/generate', validate(generateFromPRSchema), socialController.generateFromPR);

// Standalone draft generation (Create Post page)
router.post('/generate-standalone', validate(generateStandaloneSchema), socialController.generateStandalone);

// Get posts for a PR
router.get('/pr/:prId', socialController.getPostsForPR);

// List recent posts (for Create Post page history)
router.get('/', socialController.listRecent);

// Update draft text / image
router.patch('/:id', validate(updateDraftSchema), socialController.updateDraft);

// Publish all posts (Publish Both)
router.post('/publish', validate(publishAllSchema), socialController.publishAll);

// Publish a single post
router.post('/:id/publish', socialController.publishPost);

module.exports = router;
