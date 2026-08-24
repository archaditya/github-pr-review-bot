const config = require('../config');
const authService = require('../services/auth.service');
const db = require('../models');

const STATE_COOKIE = 'archadi_oauth_state';
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // 10 min — just long enough for the OAuth round trip
const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches auth.service.js's JWT_EXPIRES_IN

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge,
  };
}

/**
 * GET /auth/github/login — redirects the browser to GitHub's OAuth authorize page.
 * Stores the CSRF state nonce in a short-lived httpOnly cookie (double-submit pattern —
 * no server-side session store needed to verify it on callback).
 */
function login(req, res) {
  const { url, state } = authService.buildLoginRedirect();
  res.cookie(STATE_COOKIE, state, cookieOptions(STATE_COOKIE_MAX_AGE_MS));
  res.redirect(url);
}

/**
 * GET /auth/github/callback — GitHub redirects here with `code` + `state`. On success,
 * issues our session JWT as an httpOnly cookie and redirects back to the web dashboard.
 */
async function callback(req, res, next) {
  try {
    const { code, state } = req.query;
    const expectedState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE);

    if (!code || !state || !expectedState || state !== expectedState) {
      return res.redirect(`${config.webAppUrl}/login?error=invalid_state`);
    }

    const { token } = await authService.completeLogin({ code });
    res.cookie(config.auth.sessionCookieName, token, cookieOptions(SESSION_COOKIE_MAX_AGE_MS));

    return res.redirect(config.webAppUrl);
  } catch (err) {
    return next(err);
  }
}

function logout(req, res) {
  res.clearCookie(config.auth.sessionCookieName);
  res.status(204).send();
}

async function me(req, res, next) {
  try {
    const user = await db.User.findByPk(req.user.sub, {
      attributes: ['id', 'githubUserId', 'email', 'name'],
    });

    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    return res.json({ data: user });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, callback, logout, me };
