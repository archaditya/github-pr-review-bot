const { Router } = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const settingsController = require('../controllers/settings.controller');

const router = Router();

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.put('/ai-key', settingsController.saveAiKey);
router.delete('/ai-key', settingsController.removeAiKey);
router.post('/test-ai-key', settingsController.testAiKey);
router.put('/preferences', settingsController.updatePreferences);

module.exports = router;
