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
  return jwt.sign({ sub: user.id }, config.auth.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
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

  const [user] = await db.User.findOrCreate({
    where: { githubUserId: profile.id },
    defaults: {
      githubUserId: profile.id,
      email: profile.email || null,
      name: profile.name || profile.login,
    },
  });

  // Keep profile fields reasonably fresh on repeat logins without a separate "sync" step.
  await user.update({
    email: profile.email || user.email,
    name: profile.name || profile.login || user.name,
  });

  // Link any installations for this account to this user
  await db.Installation.update(
    { installedByUserId: user.id },
    { where: { accountLogin: profile.login, installedByUserId: null } },
  );

  const token = issueToken(user);
  return { user, token };
}

module.exports = { buildLoginRedirect, completeLogin, issueToken };
