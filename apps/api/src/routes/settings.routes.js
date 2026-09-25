const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { aiKeyTestLimiter } = require('../middlewares/rate-limiters');
const settingsController = require('../controllers/settings.controller');
const {
  saveAiKeySchema,
  testAiKeySchema,
  updatePreferencesSchema,
} = require('../validators/settings.validator');

const router = Router();

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.put('/ai-key', validate(saveAiKeySchema), settingsController.saveAiKey);
router.delete('/ai-key', settingsController.removeAiKey);
router.post('/test-ai-key', aiKeyTestLimiter, validate(testAiKeySchema), settingsController.testAiKey);
router.put('/preferences', validate(updatePreferencesSchema), settingsController.updatePreferences);

module.exports = router;
