const { Router } = require('express');
const healthRoutes = require('./health.routes');
const webhookRoutes = require('./webhooks.routes');
const authRoutes = require('./auth.routes');
const repositoryRoutes = require('./repositories.routes');
const reviewJobRoutes = require('./review-jobs.routes');
const apiKeyRoutes = require('./api-keys.routes');
const socialRoutes = require('./social.routes');
const mergeRoutes = require('./merge.routes');
const mediaRoutes = require('./media.routes');
const settingsRoutes = require('./settings.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/auth', authRoutes);
router.use('/repositories', repositoryRoutes);
router.use('/review-jobs', reviewJobRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/social-posts', socialRoutes);
router.use('/pull-requests', mergeRoutes);
router.use('/media', mediaRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin', adminRoutes);

module.exports = router;

