const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { adminLimiter } = require('../middlewares/rate-limiters');
const adminController = require('../controllers/admin.controller');
const {
  updateUserStatusSchema,
  updateUserRoleSchema,
  updateUserFeaturesSchema,
} = require('../validators/admin.validator');

const router = Router();

// Both authentication and admin role are mandatory for all /admin routes
router.use(requireAuth);
router.use(requireAdmin);
router.use(adminLimiter);

router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', validate(updateUserStatusSchema), adminController.updateUserStatus);
router.patch('/users/:id/role', validate(updateUserRoleSchema), adminController.updateUserRole);
router.patch('/users/:id/features', validate(updateUserFeaturesSchema), adminController.updateUserFeatures);
router.get('/stats', adminController.getStats);

module.exports = router;
