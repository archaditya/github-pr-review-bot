const { Router } = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const reviewJobsController = require('../controllers/review-jobs.controller');
const { listReviewJobsQuerySchema } = require('../validators/review-job.validator');

const router = Router();

router.use(requireAuth);

router.get('/', validate(listReviewJobsQuerySchema, 'query'), reviewJobsController.listByRepository);
router.get('/:id', reviewJobsController.get);

module.exports = router;
