const { Router } = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const repositoriesController = require('../controllers/repositories.controller');
const { updateRepositorySchema } = require('../validators/repository.validator');

const router = Router();

router.use(requireAuth);

router.get('/', repositoriesController.list);
router.get('/:id', repositoriesController.get);
router.patch('/:id', validate(updateRepositorySchema), repositoriesController.update);
router.post('/:id/reindex', repositoriesController.reindex);

module.exports = router;
