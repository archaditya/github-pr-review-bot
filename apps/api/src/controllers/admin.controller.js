const adminService = require('../services/admin.service');

async function listUsers(req, res, next) {
  try {
    const users = await adminService.listUsers();
    return res.json({ data: users });
  } catch (err) {
    return next(err);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = await adminService.updateUserStatus(id, status);
    return res.json({ data: user });
  } catch (err) {
    return next(err);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const user = await adminService.updateUserRole(id, role);
    return res.json({ data: user });
  } catch (err) {
    return next(err);
  }
}

async function updateUserFeatures(req, res, next) {
  try {
    const { id } = req.params;
    const { features } = req.body;
    const user = await adminService.updateUserFeatures(id, features);
    return res.json({ data: user });
  } catch (err) {
    return next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await adminService.getAdminStats();
    return res.json({ data: stats });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listUsers,
  updateUserStatus,
  updateUserRole,
  updateUserFeatures,
  getStats,
};
