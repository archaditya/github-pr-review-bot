const { Router } = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const repositoriesController = require('../controllers/repositories.controller');
const { updateRepositorySchema } = require('../validators/repository.validator');

const router = Router();

router.use(requireAuth);

const chatRoutes = require('./chat.routes');
router.use('/:id/chat', chatRoutes);

router.get('/', repositoriesController.list);
router.post('/sync', repositoriesController.sync);
router.get('/:id', repositoriesController.get);
router.patch('/:id', validate(updateRepositorySchema), repositoriesController.update);
router.post('/:id/reindex', repositoriesController.reindex);
router.post('/:id/reset-index', repositoriesController.resetIndex);

module.exports = router;
