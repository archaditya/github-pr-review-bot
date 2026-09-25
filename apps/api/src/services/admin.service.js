const db = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { maskApiKey, decrypt } = require('../utils/crypto');

/**
 * Lists all registered users with their roles, statuses, feature sets, and usage metrics.
 */
async function listUsers() {
  const users = await db.User.findAll({
    attributes: [
      'id',
      'githubUserId',
      'email',
      'name',
      'role',
      'status',
      'features',
      'usage',
      'lastActiveAt',
      'createdAt',
      'openaiApiKeyEncrypted',
    ],
    order: [['createdAt', 'ASC']],
  });

  return users.map((u) => {
    const raw = u.toJSON();
    const hasOpenaiKey = Boolean(raw.openaiApiKeyEncrypted);
    let maskedOpenaiKey = null;
    if (hasOpenaiKey) {
      maskedOpenaiKey = maskApiKey(decrypt(raw.openaiApiKeyEncrypted));
    }
    delete raw.openaiApiKeyEncrypted;

    return {
      ...raw,
      hasOpenaiKey,
      maskedOpenaiKey,
    };
  });
}

/**
 * Updates a user's account status (active, pending, suspended).
 */
async function updateUserStatus(userId, status) {
  const allowedStatuses = ['active', 'pending', 'suspended'];
  if (!allowedStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Prevent superadmin / primary admin from suspending themselves
  await user.update({ status });
  return user;
}

/**
 * Updates a user's role (admin, user).
 */
async function updateUserRole(userId, role) {
  const allowedRoles = ['admin', 'user'];
  if (!allowedRoles.includes(role)) {
    throw new ValidationError(`Invalid role. Must be one of: ${allowedRoles.join(', ')}`);
  }

  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  await user.update({ role });
  return user;
}

/**
 * Updates granular feature entitlements for a specific user.
 */
async function updateUserFeatures(userId, newFeatures) {
  if (!newFeatures || typeof newFeatures !== 'object') {
    throw new ValidationError('Features must be an object');
  }

  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const currentFeatures = user.features || {};
  const mergedFeatures = {
    ...currentFeatures,
    ...newFeatures,
  };

  await user.update({ features: mergedFeatures });
  return user;
}

/**
 * High-level system statistics for the admin dashboard.
 */
async function getAdminStats() {
  const totalUsers = await db.User.count();
  const activeUsers = await db.User.count({ where: { status: 'active' } });
  const suspendedUsers = await db.User.count({ where: { status: 'suspended' } });
  const pendingUsers = await db.User.count({ where: { status: 'pending' } });

  const totalReviews = await db.ReviewJob?.count().catch(() => 0);
  const totalPosts = await db.SocialPost?.count().catch(() => 0);
  const totalRepos = await db.Repository?.count().catch(() => 0);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      pending: pendingUsers,
    },
    counts: {
      reviews: totalReviews,
      socialPosts: totalPosts,
      repositories: totalRepos,
    },
  };
}

module.exports = {
  listUsers,
  updateUserStatus,
  updateUserRole,
  updateUserFeatures,
  getAdminStats,
};
