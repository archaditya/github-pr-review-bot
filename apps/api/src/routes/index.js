const { Router } = require('express');
const healthRoutes = require('./health.routes');
const webhookRoutes = require('./webhooks.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/webhooks', webhookRoutes);

// Mounted as they're implemented:
// router.use('/auth', authRoutes);
// router.use('/repositories', repositoryRoutes);
// router.use('/review-jobs', reviewJobRoutes);

module.exports = router;
