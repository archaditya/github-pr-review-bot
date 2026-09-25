const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const adminController = require('../controllers/admin.controller');

const router = Router();

// Both authentication and admin role are mandatory for all /admin routes
router.use(requireAuth);
router.use(requireAdmin);

router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/role', adminController.updateUserRole);
router.patch('/users/:id/features', adminController.updateUserFeatures);
router.get('/stats', adminController.getStats);

module.exports = router;
