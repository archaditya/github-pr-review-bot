const config = require('../../config');

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';

/**
 * Builds the GitHub OAuth authorize URL for user login (ADR-007's "thinner OAuth flow" —
 * distinct from the GitHub App's installation tokens in ../github/app-auth.js). `state` is
 * a CSRF nonce the caller generates and verifies on callback.
 */
function buildAuthorizeUrl({ state, redirectUri }) {
  const params = new URLSearchParams({
    client_id: config.github.oauthClientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.github.oauthClientId,
      client_secret: config.github.oauthClientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const err = new Error(data.error_description || 'GitHub OAuth token exchange failed');
    err.cause = data;
    throw err;
  }

  return data.access_token;
}

async function fetchAuthenticatedUser(accessToken) {
  const res = await fetch(USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'archadi-pr-review',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub user profile fetch failed with status ${res.status}`);
  }

  return res.json(); // { id, login, name, email, ... }
}

module.exports = { buildAuthorizeUrl, exchangeCodeForToken, fetchAuthenticatedUser };
