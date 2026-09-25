const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const apiKeyController = require('../controllers/api-key.controller');
const { createApiKeySchema } = require('../validators/api-key.validator');

const router = Router();

router.get('/', apiKeyController.listKeys);
router.post('/', validate(createApiKeySchema), apiKeyController.createKey);
router.patch('/:id/revoke', apiKeyController.revokeKey);
router.delete('/:id', apiKeyController.deleteKey);

module.exports = router;
