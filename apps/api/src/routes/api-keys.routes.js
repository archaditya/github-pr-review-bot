const { Router } = require('express');
const apiKeyController = require('../controllers/api-key.controller');

const router = Router();

router.get('/', apiKeyController.listKeys);
router.post('/', apiKeyController.createKey);
router.patch('/:id/revoke', apiKeyController.revokeKey);
router.delete('/:id', apiKeyController.deleteKey);

module.exports = router;
