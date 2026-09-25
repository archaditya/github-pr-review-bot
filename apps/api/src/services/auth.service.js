const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../models');
const config = require('../config');
const oauthClient = require('../integrations/github/oauth-client');

const STATE_BYTES = 16;
const JWT_EXPIRES_IN = '7d';

function generateState() {
  return crypto.randomBytes(STATE_BYTES).toString('hex');
}

/**
 * Starts the login flow: generates a CSRF state nonce and the GitHub authorize URL.
 * The controller is responsible for storing `state` (in a short-lived cookie) and
 * redirecting the browser to `url`.
 */
function buildLoginRedirect() {
  const state = generateState();
  const url = oauthClient.buildAuthorizeUrl({
    state,
    redirectUri: config.github.oauthRedirectUri,
  });
  return { url, state };
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role || 'user', status: user.status || 'active' },
    config.auth.jwtSecret,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

/**
 * Completes the login flow: exchanges the OAuth code for a token, fetches the GitHub
 * profile, upserts the User row, and issues our own session JWT. State/CSRF verification
 * happens in the controller (it owns the cookie) before this is ever called.
 */
async function completeLogin({ code }) {
  const accessToken = await oauthClient.exchangeCodeForToken({
    code,
    redirectUri: config.github.oauthRedirectUri,
  });
  const profile = await oauthClient.fetchAuthenticatedUser(accessToken);

  const isSuperAdmin = (profile.login && profile.login.toLowerCase() === 'archaditya') ||
    (await db.User.count()) === 0;

  const [user, created] = await db.User.findOrCreate({
    where: { githubUserId: profile.id },
    defaults: {
      githubUserId: profile.id,
      email: profile.email || null,
      name: profile.name || profile.login,
      role: isSuperAdmin ? 'admin' : 'user',
      status: 'active',
      features: isSuperAdmin ? {
        can_review_prs: true,
        can_repo_chat: true,
        can_social_studio: true,
        allowed_social_platforms: ['x', 'linkedin', 'instagram', 'facebook'],
        social_monthly_quota: 0,
        ai_provider_mode: 'managed',
        max_indexed_repos: 50,
      } : {
        can_review_prs: true,
        can_repo_chat: true,
        can_social_studio: true,
        allowed_social_platforms: ['linkedin', 'instagram', 'facebook'],
        social_monthly_quota: 20,
        ai_provider_mode: 'byok_only',
        max_indexed_repos: 5,
      },
    },
  });

  const updates = {
    email: profile.email || user.email,
    name: profile.name || profile.login || user.name,
    lastActiveAt: new Date(),
  };

  if (isSuperAdmin && user.role !== 'admin') {
    updates.role = 'admin';
  }

  await user.update(updates);

  // Link any installations for this account to this user
  await db.Installation.update(
    { installedByUserId: user.id },
    { where: { accountLogin: profile.login, installedByUserId: null } },
  );

  const token = issueToken(user);
  return { user, token };
}

module.exports = { buildLoginRedirect, completeLogin, issueToken };
